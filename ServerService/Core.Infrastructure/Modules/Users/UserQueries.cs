using Core.Domain.Modules.Users;

namespace Core.Infrastructure.Modules.Users;

/// <summary>Query filters shared by the user, role, auth and notification services.</summary>
public static class UserQueries
{
    /// <summary>Users that are not deleted, not disabled and may sign in.</summary>
    public static IQueryable<SysUser> ActiveUsers(this IQueryable<SysUser> users) =>
        users.Where(x => x.ValidFlg == 1 && x.EnableFl == 1 && x.IsActive);

    /// <summary>Users that are not soft-deleted (active or locked).</summary>
    public static IQueryable<SysUser> NotDeleted(this IQueryable<SysUser> users) =>
        users.Where(x => x.ValidFlg == 1);

    public static IQueryable<SysUserRole> ActiveRoles(this IQueryable<SysUserRole> userRoles) =>
        userRoles.Where(x => x.Status == "1" && x.Role.ValidFlg == 1);

    public static bool IsLegacyAdmin(string? authFl) =>
        (authFl ?? string.Empty).Split(',', StringSplitOptions.TrimEntries).Contains("0");
}
