using Core.Domain.Modules.Languages;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

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

    /// <summary>
    /// Language each user works in: their own choice while it is active, otherwise the default language (same rule as
    /// UserProfileBuilder). For texts written to other users, e.g. notifications in the recipient's language.
    /// </summary>
    public static async Task<Dictionary<int, string>> LanguagesOfAsync(this CoreContext db, IReadOnlyCollection<int> userIds,
        CancellationToken ct)
    {
        var active = await db.Languages.AsNoTracking().Where(x => x.IsActive).Select(x => new { x.Code, x.IsDefault }).ToListAsync(ct);
        var fallback = active.FirstOrDefault(x => x.IsDefault)?.Code ?? Language.Vietnamese;
        var users = await db.Users.AsNoTracking().Where(x => userIds.Contains(x.UserId)).Select(x => new { x.UserId, x.Language }).ToListAsync(ct);
        return userIds.Distinct().ToDictionary(id => id, id =>
            users.FirstOrDefault(u => u.UserId == id)?.Language is { } own && active.Any(a => a.Code == own) ? own : fallback);
    }

    public static bool IsLegacyAdmin(string? authFl) =>
        (authFl ?? string.Empty).Split(',', StringSplitOptions.TrimEntries).Contains("0");
}
