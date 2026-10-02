using Core.Application.Common.Exceptions;
using Core.Application.Common.Localization;
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
    /// <summary>The seven actions with the message key of their name (action.*).</summary>
    private static readonly (string NameKey, Func<ActionPermissions, bool> Get)[] Actions =
    [
        ("action.view", a => a.View), ("action.create", a => a.Create), ("action.edit", a => a.Edit),
        ("action.delete", a => a.Delete), ("action.approve", a => a.Approve), ("action.print", a => a.Print),
        ("action.export", a => a.Export)
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
                    throw new ForbiddenException("grant.action", new Text(name), FunctionCatalog.Name(function));
        }

        var ownRights = await permissions.GetRightsAsync(actorUserId, ct);
        var oldRights = (rightsBefore ?? []).ToHashSet(StringComparer.Ordinal);
        var extra = (rightsAfter ?? []).FirstOrDefault(key => !oldRights.Contains(key) && !ownRights.Contains(key));
        if (extra is not null)
        {
            var (function, code) = SpecialRightCatalog.Split(extra);
            var name = SpecialRightCatalog.All.FirstOrDefault(r => r.Function == function && r.Code == code)?.Name ?? code;
            throw new ForbiddenException("grant.action", name, FunctionCatalog.Name(function));
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
            throw new ForbiddenException("grant.unit", extra);
    }

    /// <summary>Only administrators may change their own permissions.</summary>
    public async Task EnsureNotSelfAsync(int actorUserId, int targetUserId, CancellationToken ct)
    {
        if (actorUserId == targetUserId && !await permissions.IsAdminAsync(actorUserId, ct))
            throw new ForbiddenException("grant.self");
    }
}
