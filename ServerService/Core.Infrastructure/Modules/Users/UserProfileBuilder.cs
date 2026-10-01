using Core.Application.Common.Localization;
using Core.Application.Common.Permissions;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Languages;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Users;

/// <summary>Builds frontend UserProfile objects for many users with a fixed number of queries.</summary>
public sealed class UserProfileBuilder(CoreContext db)
{
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
        var languages = await db.Languages.AsNoTracking().Where(x => x.IsActive).Select(x => new { x.Code, x.IsDefault }).ToListAsync(ct);
        var defaultLanguage = languages.FirstOrDefault(x => x.IsDefault)?.Code ?? Language.Vietnamese;

        return users.Select(user =>
        {
            var assigned = roles.Where(x => x.UserId == user.UserId)
                .OrderBy(x => x.RoleCode == SysRole.AdminCode ? 0 : 1).ThenBy(x => x.RoleName).ToList();
            var isAdmin = UserQueries.IsLegacyAdmin(user.AuthFl)
                || assigned.Any(x => x.RoleCode == SysRole.AdminCode);
            var permissions = PermissionMatrix.Resolve(isAdmin,
                ownGrants.Where(x => x.UserId == user.UserId).Select(x => (x.MenuId0, x.ToActions())).ToList(),
                roleGrants.Where(x => assigned.Any(r => r.RoleId == x.RoleId)).Select(x => (x.MenuId0, x.ToActions())));
            var own = ownRights.Where(x => x.UserId == user.UserId).ToList();
            // Same rule as PermissionService, so the screen never offers what the API refuses.
            var rights = PermissionMatrix.VisibleRights(PermissionMatrix.ResolveRights(isAdmin,
                roleRights.Where(x => assigned.Any(r => r.RoleId == x.RoleId)).Select(x => SpecialRightCatalog.Key(x.MenuId0, x.RightCode)),
                own.Where(x => x.IsGranted).Select(x => SpecialRightCatalog.Key(x.MenuId0, x.RightCode)),
                own.Where(x => !x.IsGranted).Select(x => SpecialRightCatalog.Key(x.MenuId0, x.RightCode))), permissions);
            var primaryRole = assigned.FirstOrDefault();
            var units = isAdmin ? activeUnits
                : userUnits.Where(x => x.UserId == user.UserId).Select(x => x.UnitCode).ToList();

            return new UserProfileDto(user.UserId.ToString(), user.UserName, user.FullName,
                user.Email ?? string.Empty, primaryRole?.RoleName ?? (isAdmin ? Messages.T("roles.adminLabel") : string.Empty),
                primaryRole?.RoleId.ToString(), user.Department, user.DepartmentCode, user.Phone ?? string.Empty, user.Avatar,
                user.ThemePref, user.NotificationsEnabled, isAdmin, permissions,
                signedInUnit ?? user.MaDvcs, units, user.EmployeeCode, user.IsActive,
                rights.OrderBy(x => x, StringComparer.Ordinal).ToList(),
                // A language set inactive later falls back to the default one.
                languages.Any(x => x.Code == user.Language) ? user.Language! : defaultLanguage, user.Language);
        }).ToList();
    }
}
