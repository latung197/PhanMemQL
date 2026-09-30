using Core.Application.Common.Permissions;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Users;

/// <summary>Builds frontend UserProfile objects for many users with a fixed number of queries.</summary>
public sealed class UserProfileBuilder(CoreContext db)
{
    private const string AdminRoleLabel = "Quản trị hệ thống";

    public async Task<UserProfileDto> BuildAsync(SysUser user, string? signedInUnit, CancellationToken ct) =>
        (await BuildAsync([user], signedInUnit, ct))[0];

    /// <param name="signedInUnit">Unit of the current session; null shows each user's default unit.</param>
    public async Task<List<UserProfileDto>> BuildAsync(IReadOnlyList<SysUser> users, string? signedInUnit,
        CancellationToken ct)
    {
        var ids = users.Select(x => x.UserId).ToList();
        var roles = await db.UserRoles.AsNoTracking().ActiveRoles().Where(x => ids.Contains(x.UserId))
            .Select(x => new { x.UserId, x.RoleId, x.Role.RoleCode, x.Role.RoleName }).ToListAsync(ct);
        var roleIds = roles.Select(x => x.RoleId).Distinct().ToList();
        var roleGrants = await db.RoleCommands.AsNoTracking()
            .Where(x => roleIds.Contains(x.RoleId) && x.Status == "1").ToListAsync(ct);
        var ownGrants = await db.UserCommands.AsNoTracking()
            .Where(x => ids.Contains(x.UserId) && x.Status == "1").ToListAsync(ct);
        var roleRights = await db.RoleRights.AsNoTracking()
            .Where(x => roleIds.Contains(x.RoleId) && x.Status == "1").ToListAsync(ct);
        var ownRights = await db.UserRights.AsNoTracking()
            .Where(x => ids.Contains(x.UserId) && x.Status == "1").ToListAsync(ct);
        var userUnits = await db.UserCompanyUnits.AsNoTracking()
            .Where(x => ids.Contains(x.UserId) && x.Unit.IsActive)
            .OrderBy(x => x.Unit.SortOrder).ThenBy(x => x.UnitCode)
            .Select(x => new { x.UserId, x.UnitCode }).ToListAsync(ct);
        var activeUnits = await db.CompanyUnits.AsNoTracking().Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Code).Select(x => x.Code).ToListAsync(ct);

        return users.Select(user =>
        {
            var assigned = roles.Where(x => x.UserId == user.UserId)
                .OrderBy(x => x.RoleCode == SysRole.AdminCode ? 0 : 1).ThenBy(x => x.RoleName).ToList();
            var isAdmin = UserQueries.IsLegacyAdmin(user.AuthFl)
                || assigned.Any(x => x.RoleCode == SysRole.AdminCode);
            var permissions = PermissionMatrix.Resolve(isAdmin,
                ownGrants.Where(x => x.UserId == user.UserId).Select(x => (x.MenuId0, x.ToActions())).ToList(),
                roleGrants.Where(x => assigned.Any(r => r.RoleId == x.RoleId)).Select(x => (x.MenuId0, x.ToActions())));
            var rights = PermissionMatrix.ResolveRights(isAdmin, ownGrants.Any(x => x.UserId == user.UserId),
                ownRights.Where(x => x.UserId == user.UserId).Select(x => SpecialRightCatalog.Key(x.MenuId0, x.RightCode)),
                roleRights.Where(x => assigned.Any(r => r.RoleId == x.RoleId)).Select(x => SpecialRightCatalog.Key(x.MenuId0, x.RightCode)));
            var primaryRole = assigned.FirstOrDefault();
            var units = isAdmin ? activeUnits
                : userUnits.Where(x => x.UserId == user.UserId).Select(x => x.UnitCode).ToList();

            return new UserProfileDto(user.UserId.ToString(), user.UserName, user.FullName,
                user.Email ?? string.Empty, primaryRole?.RoleName ?? (isAdmin ? AdminRoleLabel : string.Empty),
                primaryRole?.RoleId.ToString(), user.Department, user.Phone ?? string.Empty, user.Avatar,
                user.ThemePref, user.NotificationsEnabled, isAdmin, permissions,
                signedInUnit ?? user.MaDvcs, units, user.EmployeeCode, user.IsActive,
                rights.OrderBy(x => x, StringComparer.Ordinal).ToList());
        }).ToList();
    }
}
