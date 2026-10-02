using Core.Application.Common.Caching;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Users;

/// <summary>
/// What a user may do. Read on almost every request (token check, [RequirePermission], unit access), so one snapshot
/// per user (account state, admin flag, permission matrix, special rights, units) is kept in the shared cache
/// (IAppCache). Any write to the account, role or permission tables drops it at once (CacheInvalidationInterceptor),
/// so revoking a right or locking an account still takes effect on the very next request. Inside an open transaction
/// the snapshot is read from the database (it may see uncommitted rows) and only kept for this request.
/// </summary>
public sealed class PermissionService(CoreContext db, IAppCache cache) : IPermissionService
{
    private sealed record UserAccess(bool IsActive, int SecurityVersion, bool IsAdmin,
        IReadOnlyDictionary<string, ActionPermissions> Matrix, IReadOnlySet<string> Rights, IReadOnlySet<string> Units);

    private readonly Dictionary<int, UserAccess> _access = [];
    private readonly Dictionary<int, IReadOnlyDictionary<string, ActionPermissions>> _matrixCache = [];

    private static string KeyOf(int userId) => $"access:{userId}";

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
        var isAdmin = account is not null && (UserQueries.IsLegacyAdmin(account.AuthFl)
            || await db.UserRoles.ActiveRoles().AnyAsync(x => x.UserId == userId && x.Role.RoleCode == SysRole.AdminCode, ct));
        var units = (await db.UserCompanyUnits.AsNoTracking().Where(x => x.UserId == userId).Select(x => x.UnitCode)
            .ToListAsync(ct)).ToHashSet(StringComparer.Ordinal);
        if (isAdmin)
            return new UserAccess(true, account!.SecurityVersion, true, PermissionMatrix.Uniform(ActionPermissions.Full),
                SpecialRightCatalog.Keys, units);

        var roleIds = db.UserRoles.ActiveRoles().Where(x => x.UserId == userId).Select(x => x.RoleId);
        var own = await db.UserCommands.AsNoTracking().Where(x => x.UserId == userId && x.Status == "1").ToListAsync(ct);
        var fromRoles = await db.RoleCommands.AsNoTracking()
            .Where(x => x.Status == "1" && roleIds.Contains(x.RoleId)).ToListAsync(ct);
        var matrix = PermissionMatrix.Resolve(false, own.Select(x => (x.MenuId0, x.ToActions())).ToList(),
            fromRoles.Select(x => (x.MenuId0, x.ToActions())));

        var ownRights = await db.UserRights.AsNoTracking().Where(x => x.UserId == userId && x.Status == "1")
            .Select(x => new { Key = x.MenuId0 + ":" + x.RightCode, x.IsGranted }).ToListAsync(ct);
        var roleRights = await db.RoleRights.AsNoTracking().Where(x => x.Status == "1" && roleIds.Contains(x.RoleId))
            .Select(x => x.MenuId0 + ":" + x.RightCode).ToListAsync(ct);
        var rights = PermissionMatrix.ResolveRights(false, roleRights,
            ownRights.Where(x => x.IsGranted).Select(x => x.Key), ownRights.Where(x => !x.IsGranted).Select(x => x.Key));
        return new UserAccess(account is not null, account?.SecurityVersion ?? -1, false, matrix,
            PermissionMatrix.VisibleRights(rights, matrix).ToHashSet(StringComparer.Ordinal), units);
    }

    public async Task<bool> IsAdminAsync(int userId, CancellationToken ct = default) =>
        (await AccessAsync(userId, ct)).IsAdmin;

    public async Task<bool> IsTokenCurrentAsync(int userId, int securityVersion, CancellationToken ct = default)
    {
        var access = await AccessAsync(userId, ct);
        return access.IsActive && access.SecurityVersion == securityVersion;
    }

    public async Task<IReadOnlyDictionary<string, ActionPermissions>> GetEffectiveAsync(int userId,
        CancellationToken ct = default) => (await AccessAsync(userId, ct)).Matrix;

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

    public async Task<IReadOnlyDictionary<int, IReadOnlyDictionary<string, ActionPermissions>>> GetEffectiveManyAsync(
        IReadOnlyCollection<int> userIds, CancellationToken ct = default)
    {
        var ids = userIds.Distinct().ToList();
        var users = await db.Users.AsNoTracking().ActiveUsers().Where(x => ids.Contains(x.UserId))
            .Select(x => new { x.UserId, x.AuthFl }).ToListAsync(ct);
        var missing = users.Where(x => !_matrixCache.ContainsKey(x.UserId)).ToList();
        if (missing.Count > 0)
        {
            var missingIds = missing.Select(x => x.UserId).ToList();
            var userRoles = await db.UserRoles.AsNoTracking().ActiveRoles().Where(x => missingIds.Contains(x.UserId))
                .Select(x => new { x.UserId, x.RoleId, x.Role.RoleCode }).ToListAsync(ct);
            var roleIds = userRoles.Select(x => x.RoleId).Distinct().ToList();
            var roleRows = await db.RoleCommands.AsNoTracking().Where(x => x.Status == "1" && roleIds.Contains(x.RoleId)).ToListAsync(ct);
            var ownRows = await db.UserCommands.AsNoTracking().Where(x => x.Status == "1" && missingIds.Contains(x.UserId)).ToListAsync(ct);
            foreach (var user in missing)
            {
                var roles = userRoles.Where(x => x.UserId == user.UserId).ToList();
                // Same rule as IsAdminAsync: legacy flag or the ADMIN role.
                var isAdmin = UserQueries.IsLegacyAdmin(user.AuthFl) || roles.Any(x => x.RoleCode == SysRole.AdminCode);
                _matrixCache[user.UserId] = PermissionMatrix.Resolve(isAdmin,
                    ownRows.Where(x => x.UserId == user.UserId).Select(x => (x.MenuId0, x.ToActions())).ToList(),
                    roleRows.Where(x => roles.Any(r => r.RoleId == x.RoleId)).Select(x => (x.MenuId0, x.ToActions())));
            }
        }
        return users.ToDictionary(x => x.UserId, x => _matrixCache[x.UserId]);
    }

    public async Task<IReadOnlySet<string>> GetRightsAsync(int userId, CancellationToken ct = default) =>
        (await AccessAsync(userId, ct)).Rights;

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
        _matrixCache.Remove(userId);
        cache.Remove(KeyOf(userId));
    }

    public async Task EnsureAdminAsync(int userId, CancellationToken ct = default)
    {
        if (!await IsAdminAsync(userId, ct))
            throw new ForbiddenException("permission.adminOnly");
    }
}
