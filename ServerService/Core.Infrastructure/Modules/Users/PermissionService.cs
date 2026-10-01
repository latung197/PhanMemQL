using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Users;

/// <summary>
/// Scoped per HTTP request. Results are cached for the request only, because several authorization
/// handlers ask the same questions; the next request always reads the database again, so revoking a
/// right takes effect immediately.
/// </summary>
public sealed class PermissionService(CoreContext db) : IPermissionService
{
    private readonly Dictionary<int, bool> _adminCache = [];
    private readonly Dictionary<int, IReadOnlyDictionary<string, ActionPermissions>> _matrixCache = [];
    private readonly Dictionary<int, IReadOnlySet<string>> _rightsCache = [];

    public async Task<bool> IsAdminAsync(int userId, CancellationToken ct = default)
    {
        if (_adminCache.TryGetValue(userId, out var cached)) return cached;
        var authFl = await db.Users.AsNoTracking().ActiveUsers().Where(x => x.UserId == userId)
            .Select(x => x.AuthFl).FirstOrDefaultAsync(ct);
        var isAdmin = authFl is not null && (UserQueries.IsLegacyAdmin(authFl)
            || await db.UserRoles.ActiveRoles().AnyAsync(x => x.UserId == userId
                && x.Role.RoleCode == SysRole.AdminCode, ct));
        return _adminCache[userId] = isAdmin;
    }

    public Task<bool> IsTokenCurrentAsync(int userId, int securityVersion, CancellationToken ct = default) =>
        db.Users.AsNoTracking().ActiveUsers()
            .AnyAsync(x => x.UserId == userId && x.SecurityVersion == securityVersion, ct);

    public async Task<IReadOnlyDictionary<string, ActionPermissions>> GetEffectiveAsync(int userId,
        CancellationToken ct = default)
    {
        if (_matrixCache.TryGetValue(userId, out var cached)) return cached;
        if (await IsAdminAsync(userId, ct)) return _matrixCache[userId] = PermissionMatrix.Uniform(ActionPermissions.Full);

        var own = await db.UserCommands.AsNoTracking()
            .Where(x => x.UserId == userId && x.Status == "1").ToListAsync(ct);
        var roleIds = db.UserRoles.ActiveRoles().Where(x => x.UserId == userId).Select(x => x.RoleId);
        var fromRoles = await db.RoleCommands.AsNoTracking()
            .Where(x => x.Status == "1" && roleIds.Contains(x.RoleId)).ToListAsync(ct);
        return _matrixCache[userId] = PermissionMatrix.Resolve(false,
            own.Select(x => (x.MenuId0, x.ToActions())).ToList(),
            fromRoles.Select(x => (x.MenuId0, x.ToActions())));
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
                _adminCache[user.UserId] = isAdmin;
                _matrixCache[user.UserId] = PermissionMatrix.Resolve(isAdmin,
                    ownRows.Where(x => x.UserId == user.UserId).Select(x => (x.MenuId0, x.ToActions())).ToList(),
                    roleRows.Where(x => roles.Any(r => r.RoleId == x.RoleId)).Select(x => (x.MenuId0, x.ToActions())));
            }
        }
        return users.ToDictionary(x => x.UserId, x => _matrixCache[x.UserId]);
    }

    public async Task<IReadOnlySet<string>> GetRightsAsync(int userId, CancellationToken ct = default)
    {
        if (_rightsCache.TryGetValue(userId, out var cached)) return cached;
        var isAdmin = await IsAdminAsync(userId, ct);
        if (isAdmin) return _rightsCache[userId] = SpecialRightCatalog.Keys;
        var own = await db.UserRights.AsNoTracking().Where(x => x.UserId == userId && x.Status == "1")
            .Select(x => new { Key = x.MenuId0 + ":" + x.RightCode, x.IsGranted }).ToListAsync(ct);
        var roleIds = db.UserRoles.ActiveRoles().Where(x => x.UserId == userId).Select(x => x.RoleId);
        var fromRoles = await db.RoleRights.AsNoTracking()
            .Where(x => x.Status == "1" && roleIds.Contains(x.RoleId))
            .Select(x => x.MenuId0 + ":" + x.RightCode).ToListAsync(ct);
        var rights = PermissionMatrix.ResolveRights(false, fromRoles,
            own.Where(x => x.IsGranted).Select(x => x.Key), own.Where(x => !x.IsGranted).Select(x => x.Key));
        return _rightsCache[userId] = PermissionMatrix.VisibleRights(rights, await GetEffectiveAsync(userId, ct))
            .ToHashSet(StringComparer.Ordinal);
    }

    public async Task<bool> HasRightAsync(int userId, string function, string rightCode, CancellationToken ct = default) =>
        (await GetRightsAsync(userId, ct)).Contains(SpecialRightCatalog.Key(function, rightCode));

    public async Task EnsureAllowedAsync(int userId, string function, PermissionAction action,
        CancellationToken ct = default)
    {
        var matrix = await GetEffectiveAsync(userId, ct);
        if (!matrix.TryGetValue(function, out var actions) || !actions.Allows(action))
            throw new ForbiddenException("permission.denied");
    }

    public void Forget(int userId)
    {
        _adminCache.Remove(userId);
        _matrixCache.Remove(userId);
        _rightsCache.Remove(userId);
    }

    public async Task EnsureAdminAsync(int userId, CancellationToken ct = default)
    {
        if (!await IsAdminAsync(userId, ct))
            throw new ForbiddenException("permission.adminOnly");
    }
}
