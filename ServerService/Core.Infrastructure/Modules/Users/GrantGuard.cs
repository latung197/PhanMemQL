using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Users;

/// <summary>
/// Stops a user manager from handing out more than they hold: a non-administrator may only add
/// actions, special rights and company units that they have themselves. What the target already had
/// may stay, so editing an account with wider rights still works as long as nothing is added.
/// Administrators are not limited.
/// </summary>
public sealed class GrantGuard(CoreContext db, IPermissionService permissions)
{
    private static readonly (string Name, Func<ActionPermissions, bool> Get)[] Actions =
    [
        ("Xem", a => a.View), ("Thêm & Sửa", a => a.CreateEdit), ("Xóa", a => a.Delete),
        ("Phê duyệt", a => a.Approve), ("In & Xuất file", a => a.PrintExport)
    ];

    public async Task EnsureCanGrantAsync(int actorUserId,
        IReadOnlyDictionary<string, ActionPermissions>? before, IReadOnlyDictionary<string, ActionPermissions>? after,
        IEnumerable<string>? rightsBefore, IEnumerable<string>? rightsAfter, CancellationToken ct)
    {
        if (await permissions.IsAdminAsync(actorUserId, ct)) return;
        var own = await permissions.GetEffectiveAsync(actorUserId, ct);
        foreach (var (function, wanted) in after ?? new Dictionary<string, ActionPermissions>())
        {
            var had = before?.GetValueOrDefault(function);
            var mine = own.GetValueOrDefault(function);
            foreach (var (name, get) in Actions)
                if (get(wanted) && !(had is not null && get(had)) && !(mine is not null && get(mine)))
                    throw new ForbiddenException(
                        $"Bạn không thể cấp quyền \"{name}\" trên \"{FunctionName(function)}\" vì chính bạn không có quyền này.");
        }

        var ownRights = await permissions.GetRightsAsync(actorUserId, ct);
        var oldRights = (rightsBefore ?? []).ToHashSet(StringComparer.Ordinal);
        var extra = (rightsAfter ?? []).FirstOrDefault(key => !oldRights.Contains(key) && !ownRights.Contains(key));
        if (extra is not null)
        {
            var (function, code) = SpecialRightCatalog.Split(extra);
            var name = SpecialRightCatalog.All.FirstOrDefault(r => r.Function == function && r.Code == code)?.Name ?? code;
            throw new ForbiddenException(
                $"Bạn không thể cấp quyền \"{name}\" trên \"{FunctionName(function)}\" vì chính bạn không có quyền này.");
        }
    }

    /// <summary>Non-administrators may only give access to company units they can work in themselves.</summary>
    public async Task EnsureCanAssignUnitsAsync(int actorUserId, IEnumerable<string> before, IEnumerable<string> after,
        CancellationToken ct)
    {
        if (await permissions.IsAdminAsync(actorUserId, ct)) return;
        var mine = await db.UserCompanyUnits.AsNoTracking().Where(x => x.UserId == actorUserId)
            .Select(x => x.UnitCode).ToListAsync(ct);
        var old = before.ToHashSet(StringComparer.Ordinal);
        var extra = after.FirstOrDefault(code => !old.Contains(code) && !mine.Contains(code));
        if (extra is not null)
            throw new ForbiddenException($"Bạn không thể cấp quyền vào đơn vị cơ sở {extra} vì chính bạn không được vào đơn vị này.");
    }

    /// <summary>Only administrators may change their own permissions.</summary>
    public async Task EnsureNotSelfAsync(int actorUserId, int targetUserId, CancellationToken ct)
    {
        if (actorUserId == targetUserId && !await permissions.IsAdminAsync(actorUserId, ct))
            throw new ForbiddenException("Bạn không thể tự thay đổi quyền của chính mình. Hãy nhờ quản trị viên.");
    }

    private static string FunctionName(string function) => FunctionCatalog.Functions.GetValueOrDefault(function, function);
}
