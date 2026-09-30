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

    public async Task<IReadOnlySet<string>> GetRightsAsync(int userId, CancellationToken ct = default)
    {
        if (_rightsCache.TryGetValue(userId, out var cached)) return cached;
        var isAdmin = await IsAdminAsync(userId, ct);
        var hasOwnMatrix = !isAdmin && await db.UserCommands.AnyAsync(x => x.UserId == userId && x.Status == "1", ct);
        List<string> own = hasOwnMatrix
            ? await db.UserRights.AsNoTracking().Where(x => x.UserId == userId && x.Status == "1")
                .Select(x => x.MenuId0 + ":" + x.RightCode).ToListAsync(ct)
            : [];
        var roleIds = db.UserRoles.ActiveRoles().Where(x => x.UserId == userId).Select(x => x.RoleId);
        List<string> fromRoles = isAdmin || hasOwnMatrix ? [] : await db.RoleRights.AsNoTracking()
            .Where(x => x.Status == "1" && roleIds.Contains(x.RoleId))
            .Select(x => x.MenuId0 + ":" + x.RightCode).ToListAsync(ct);
        // A special right only counts on a function the user may view (same rule as the permission screen).
        var matrix = await GetEffectiveAsync(userId, ct);
        var rights = PermissionMatrix.ResolveRights(isAdmin, hasOwnMatrix, own, fromRoles);
        return _rightsCache[userId] = isAdmin ? rights : rights
            .Where(key => matrix.TryGetValue(SpecialRightCatalog.Split(key).Function, out var a) && a.View)
            .ToHashSet(StringComparer.Ordinal);
    }

    public async Task<bool> HasRightAsync(int userId, string function, string rightCode, CancellationToken ct = default) =>
        (await GetRightsAsync(userId, ct)).Contains(SpecialRightCatalog.Key(function, rightCode));

    public async Task EnsureAllowedAsync(int userId, string function, PermissionAction action,
        CancellationToken ct = default)
    {
        var matrix = await GetEffectiveAsync(userId, ct);
        if (!matrix.TryGetValue(function, out var actions) || !actions.Allows(action))
            throw new ForbiddenException("Tài khoản của bạn không có quyền thực hiện thao tác này.");
    }

    public async Task EnsureAdminAsync(int userId, CancellationToken ct = default)
    {
        if (!await IsAdminAsync(userId, ct))
            throw new ForbiddenException("Chỉ quản trị viên mới được thực hiện thao tác này.");
    }
}
