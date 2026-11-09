using System.Collections.Concurrent;
using Core.Application.Common.Caching;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Common.Security;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Users;

/// <summary>
/// What a user may do. Read on almost every request (token check, [RequirePermission], unit access), so one snapshot
/// per user (account state, admin flag, roles, the role of each company unit, own exceptions, units) is kept in the shared cache
/// (IAppCache). Any write to the account, role or permission tables drops it at once (CacheInvalidationInterceptor),
/// so revoking a right or locking an account still takes effect on the very next request. Inside an open transaction
/// the snapshot is read from the database (it may see uncommitted rows) and only kept for this request.
/// <para>
/// Rights depend on the company unit: in a unit where the user holds a unit role (sys_user_company_unit.role_id) that role replaces
/// the default role; the user's own exceptions apply in every unit. The calls without a unit use the unit of the session for the
/// signed-in user (every [RequirePermission] check and every service check of the current user) and the default role for anyone else.
/// </para>
/// </summary>
public sealed class PermissionService(CoreContext db, IAppCache cache, ICurrentUser currentUser) : IPermissionService
{
    /// <summary>Everything needed to work out the rights of the user in any unit; the result per unit is kept in <see cref="ByUnit"/>.</summary>
    private sealed record UserAccess(bool IsActive, int SecurityVersion, bool IsAdmin, IReadOnlySet<string> Units,
        IReadOnlyList<int> DefaultRoles, IReadOnlyDictionary<string, int> UnitRoles,
        IReadOnlyList<(string Function, ActionPermissions Actions)> Own, IReadOnlyList<string> OwnGranted, IReadOnlyList<string> OwnDenied,
        IReadOnlyDictionary<int, IReadOnlyList<(string Function, ActionPermissions Actions)>> RoleGrants,
        IReadOnlyDictionary<int, IReadOnlyList<string>> RoleRights, IReadOnlySet<string> AdminRights)
    {
        public ConcurrentDictionary<string, (IReadOnlyDictionary<string, ActionPermissions> Matrix, IReadOnlySet<string> Rights)> ByUnit { get; } = new();
    }

    private readonly Dictionary<int, UserAccess> _access = [];
    private readonly Dictionary<string, IReadOnlyDictionary<string, ActionPermissions>> _matrixCache = [];

    private static string KeyOf(int userId) => $"access:{userId}";

    /// <summary>The unit whose role counts: the one asked for, else the session unit for the signed-in user, else none (default role).</summary>
    private string? UnitFor(int userId, string? unitCode)
    {
        if (!string.IsNullOrWhiteSpace(unitCode)) return unitCode;
        if (currentUser.IsAuthenticated && currentUser.UserId == userId && !string.IsNullOrWhiteSpace(currentUser.UnitCode)) return currentUser.UnitCode;
        return null;
    }

    private async Task<UserAccess> AccessAsync(int userId, CancellationToken ct)
    {
        if (_access.TryGetValue(userId, out var cached)) return cached;
        return _access[userId] = await db.CachedAsync(cache, KeyOf(userId), CacheTables.UserAccess,
            token => LoadAsync(userId, token), ct);
    }

    private async Task<UserAccess> LoadAsync(int userId, CancellationToken ct)
    {
        var account = await db.Users.AsNoTracking().ActiveUsers().Where(x => x.UserId == userId)
            .Select(x => new { x.AuthFl, x.SecurityVersion }).FirstOrDefaultAsync(ct);
        var defaultRoles = await db.UserRoles.AsNoTracking().ActiveRoles().Where(x => x.UserId == userId)
            .Select(x => new { x.RoleId, x.Role.RoleCode }).ToListAsync(ct);
        var isAdmin = account is not null && (UserQueries.IsLegacyAdmin(account.AuthFl) || defaultRoles.Any(x => x.RoleCode == SysRole.AdminCode));
        var unitRows = await db.UserCompanyUnits.AsNoTracking().Where(x => x.UserId == userId)
            .Select(x => new { x.UnitCode, x.RoleId }).ToListAsync(ct);
        var units = unitRows.Select(x => x.UnitCode).ToHashSet(StringComparer.Ordinal);
        var unitRoles = unitRows.Where(x => x.RoleId != null).ToDictionary(x => x.UnitCode, x => x.RoleId!.Value, StringComparer.Ordinal);
        if (isAdmin)
        {
            var activeUnits = await db.CompanyUnits.AsNoTracking().Where(x => x.IsActive).Select(x => x.Code).ToListAsync(ct);
            return new UserAccess(true, account!.SecurityVersion, true, units, [], unitRoles, [], [], [],
                new Dictionary<int, IReadOnlyList<(string, ActionPermissions)>>(), new Dictionary<int, IReadOnlyList<string>>(),
                SpecialRightCatalog.KeysFor(activeUnits));
        }

        var roleIds = defaultRoles.Select(x => x.RoleId).Concat(unitRoles.Values).Distinct().ToList();
        var grantRows = await db.RoleCommands.AsNoTracking().Where(x => x.Status == "1" && roleIds.Contains(x.RoleId)).ToListAsync(ct);
        var rightRows = await db.RoleRights.AsNoTracking().Where(x => x.Status == "1" && roleIds.Contains(x.RoleId))
            .Select(x => new { x.RoleId, Key = x.MenuId0 + ":" + x.RightCode }).ToListAsync(ct);
        var own = await db.UserCommands.AsNoTracking().Where(x => x.UserId == userId && x.Status == "1").ToListAsync(ct);
        var ownRights = await db.UserRights.AsNoTracking().Where(x => x.UserId == userId && x.Status == "1")
            .Select(x => new { Key = x.MenuId0 + ":" + x.RightCode, x.IsGranted }).ToListAsync(ct);

        return new UserAccess(account is not null, account?.SecurityVersion ?? -1, false, units,
            defaultRoles.Select(x => x.RoleId).ToList(), unitRoles,
            own.Select(x => (x.MenuId0, x.ToActions())).ToList(),
            ownRights.Where(x => x.IsGranted).Select(x => x.Key).ToList(), ownRights.Where(x => !x.IsGranted).Select(x => x.Key).ToList(),
            roleIds.ToDictionary(id => id, id => (IReadOnlyList<(string, ActionPermissions)>)grantRows.Where(x => x.RoleId == id)
                .Select(x => (x.MenuId0, x.ToActions())).ToList()),
            roleIds.ToDictionary(id => id, id => (IReadOnlyList<string>)rightRows.Where(x => x.RoleId == id).Select(x => x.Key).ToList()),
            new HashSet<string>());
    }

    /// <summary>The matrix and special rights of the user in a unit (worked out once per unit and kept with the snapshot).</summary>
    private static (IReadOnlyDictionary<string, ActionPermissions> Matrix, IReadOnlySet<string> Rights) InUnit(UserAccess access, string? unit)
    {
        if (access.IsAdmin) return (PermissionMatrix.Uniform(ActionPermissions.Full), access.AdminRights);
        return access.ByUnit.GetOrAdd(unit ?? string.Empty, key =>
        {
            IReadOnlyList<int> roles = key.Length > 0 && access.UnitRoles.TryGetValue(key, out var unitRole) ? [unitRole] : access.DefaultRoles;
            var matrix = PermissionMatrix.Resolve(false, access.Own.ToList(),
                roles.SelectMany(id => access.RoleGrants.GetValueOrDefault(id) ?? []));
            var rights = PermissionMatrix.ResolveRights(false, roles.SelectMany(id => access.RoleRights.GetValueOrDefault(id) ?? []),
                access.OwnGranted, access.OwnDenied);
            return (matrix, PermissionMatrix.VisibleRights(rights, matrix).ToHashSet(StringComparer.Ordinal));
        });
    }

    public async Task<bool> IsAdminAsync(int userId, CancellationToken ct = default) =>
        (await AccessAsync(userId, ct)).IsAdmin;

    public async Task<bool> IsTokenCurrentAsync(int userId, int securityVersion, CancellationToken ct = default)
    {
        var access = await AccessAsync(userId, ct);
        return access.IsActive && access.SecurityVersion == securityVersion;
    }

    public Task<IReadOnlyDictionary<string, ActionPermissions>> GetEffectiveAsync(int userId, CancellationToken ct = default) =>
        GetEffectiveInUnitAsync(userId, null, ct);

    public async Task<IReadOnlyDictionary<string, ActionPermissions>> GetEffectiveInUnitAsync(int userId, string? unitCode,
        CancellationToken ct = default) => InUnit(await AccessAsync(userId, ct), UnitFor(userId, unitCode)).Matrix;

    public async Task<bool> HasUnitAccessAsync(int userId, string unitCode, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(unitCode)) return false;
        var active = await db.CachedAsync(cache, "units:active", ["sys_company_unit"], async token =>
            (IReadOnlySet<string>)(await db.CompanyUnits.AsNoTracking().Where(x => x.IsActive).Select(x => x.Code)
                .ToListAsync(token)).ToHashSet(StringComparer.Ordinal), ct);
        if (!active.Contains(unitCode)) return false;
        var access = await AccessAsync(userId, ct);
        return access.IsAdmin || access.Units.Contains(unitCode);
    }

    public async Task<IReadOnlySet<string>?> VisibleUnitsAsync(int userId, CancellationToken ct = default)
    {
        var access = await AccessAsync(userId, ct);
        return access.IsAdmin ? null : access.Units;
    }

    public async Task<IReadOnlyDictionary<int, IReadOnlyDictionary<string, ActionPermissions>>> GetEffectiveManyAsync(
        IReadOnlyCollection<int> userIds, string? unitCode, CancellationToken ct = default)
    {
        var unit = string.IsNullOrWhiteSpace(unitCode) ? null : unitCode;
        string Key(int id) => $"{id}@{unit}";
        var ids = userIds.Distinct().ToList();
        var users = await db.Users.AsNoTracking().ActiveUsers().Where(x => ids.Contains(x.UserId))
            .Select(x => new { x.UserId, x.AuthFl }).ToListAsync(ct);
        var missing = users.Where(x => !_matrixCache.ContainsKey(Key(x.UserId))).ToList();
        if (missing.Count > 0)
        {
            var missingIds = missing.Select(x => x.UserId).ToList();
            var userRoles = await db.UserRoles.AsNoTracking().ActiveRoles().Where(x => missingIds.Contains(x.UserId))
                .Select(x => new { x.UserId, x.RoleId, x.Role.RoleCode }).ToListAsync(ct);
            // The role each of them holds in the unit, when it differs from their default role.
            var unitRoles = unit is null ? []
                : await db.UserCompanyUnits.AsNoTracking().Where(x => missingIds.Contains(x.UserId) && x.UnitCode == unit && x.RoleId != null)
                    .ToDictionaryAsync(x => x.UserId, x => x.RoleId!.Value, ct);
            var roleIds = userRoles.Select(x => x.RoleId).Concat(unitRoles.Values).Distinct().ToList();
            var roleRows = await db.RoleCommands.AsNoTracking().Where(x => x.Status == "1" && roleIds.Contains(x.RoleId)).ToListAsync(ct);
            var ownRows = await db.UserCommands.AsNoTracking().Where(x => x.Status == "1" && missingIds.Contains(x.UserId)).ToListAsync(ct);
            foreach (var user in missing)
            {
                var roles = userRoles.Where(x => x.UserId == user.UserId).ToList();
                // Same rule as IsAdminAsync: legacy flag or the ADMIN role.
                var isAdmin = UserQueries.IsLegacyAdmin(user.AuthFl) || roles.Any(x => x.RoleCode == SysRole.AdminCode);
                IReadOnlyList<int> held = unitRoles.TryGetValue(user.UserId, out var unitRole) ? [unitRole] : roles.Select(x => x.RoleId).ToList();
                _matrixCache[Key(user.UserId)] = PermissionMatrix.Resolve(isAdmin,
                    ownRows.Where(x => x.UserId == user.UserId).Select(x => (x.MenuId0, x.ToActions())).ToList(),
                    roleRows.Where(x => held.Contains(x.RoleId)).Select(x => (x.MenuId0, x.ToActions())));
            }
        }
        return users.ToDictionary(x => x.UserId, x => _matrixCache[Key(x.UserId)]);
    }

    public Task<IReadOnlySet<string>> GetRightsAsync(int userId, CancellationToken ct = default) => GetRightsInUnitAsync(userId, null, ct);

    public async Task<IReadOnlySet<string>> GetRightsInUnitAsync(int userId, string? unitCode, CancellationToken ct = default) =>
        InUnit(await AccessAsync(userId, ct), UnitFor(userId, unitCode)).Rights;

    public async Task<bool> HasRightAsync(int userId, string function, string rightCode, CancellationToken ct = default) =>
        (await GetRightsAsync(userId, ct)).Contains(SpecialRightCatalog.Key(function, rightCode));

    public async Task EnsureAllowedAsync(int userId, string function, PermissionAction action,
        CancellationToken ct = default)
    {
        var matrix = await GetEffectiveAsync(userId, ct);
        if (!matrix.TryGetValue(function, out var actions) || !actions.Allows(action))
            throw new ForbiddenException("permission.denied");
    }

    public async Task EnsureAnyAllowedAsync(int userId, string function, IReadOnlyCollection<PermissionAction> actions,
        CancellationToken ct = default)
    {
        var matrix = await GetEffectiveAsync(userId, ct);
        if (!matrix.TryGetValue(function, out var granted) || !actions.Any(granted.Allows))
            throw new ForbiddenException("permission.denied");
    }

    public void Forget(int userId)
    {
        _access.Remove(userId);
        foreach (var key in _matrixCache.Keys.Where(k => k.StartsWith($"{userId}@", StringComparison.Ordinal)).ToList()) _matrixCache.Remove(key);
        cache.Remove(KeyOf(userId));
    }

    public async Task EnsureAdminAsync(int userId, CancellationToken ct = default)
    {
        if (!await IsAdminAsync(userId, ct))
            throw new ForbiddenException("permission.adminOnly");
    }
}
