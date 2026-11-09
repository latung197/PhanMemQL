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

    /// <param name="actorUnit">The company unit whose rights of the actor count (the rights given apply in that unit); null = the unit of
    /// the session.</param>
    public async Task EnsureCanGrantAsync(int actorUserId,
        IReadOnlyDictionary<string, ActionPermissions>? before, IReadOnlyDictionary<string, ActionPermissions>? after,
        IEnumerable<string>? rightsBefore, IEnumerable<string>? rightsAfter, CancellationToken ct, string? actorUnit = null)
    {
        if (await permissions.IsAdminAsync(actorUserId, ct)) return;
        var own = await permissions.GetEffectiveInUnitAsync(actorUserId, actorUnit, ct);
        foreach (var (function, wanted) in after ?? new Dictionary<string, ActionPermissions>())
        {
            var had = before?.GetValueOrDefault(function);
            var mine = own.GetValueOrDefault(function);
            foreach (var (name, get) in Actions)
                if (get(wanted) && !(had is not null && get(had)) && !(mine is not null && get(mine)))
                    throw new ForbiddenException("grant.action", new Text(name), FunctionCatalog.Name(function));
        }

        var ownRights = await permissions.GetRightsInUnitAsync(actorUserId, actorUnit, ct);
        var oldRights = (rightsBefore ?? []).ToHashSet(StringComparer.Ordinal);
        var extra = (rightsAfter ?? []).FirstOrDefault(key => !oldRights.Contains(key) && !ownRights.Contains(key));
        if (extra is not null)
        {
            var (function, fullCode) = SpecialRightCatalog.Split(extra);
            var code = SpecialRightCatalog.SplitUnit(fullCode).Code;
            var name = SpecialRightCatalog.All.FirstOrDefault(r => r.Function == function && r.Code == code)?.Name ?? code;
            throw new ForbiddenException("grant.action", name, FunctionCatalog.Name(function));
        }
    }

    /// <summary>A per-unit right ("inv_receipt:ST_POSTED@DVCS01") must name a company unit that exists.</summary>
    public async Task EnsureRightUnitsExistAsync(IEnumerable<string>? rights, CancellationToken ct)
    {
        var units = (rights ?? []).Select(key => SpecialRightCatalog.SplitUnit(SpecialRightCatalog.Split(key).Code).Unit)
            .Where(unit => unit is not null).Distinct().ToList();
        if (units.Count == 0) return;
        var known = await db.CompanyUnits.AsNoTracking().Where(x => units.Contains(x.Code)).Select(x => x.Code).ToListAsync(ct);
        var missing = units.FirstOrDefault(unit => !known.Contains(unit!));
        if (missing is not null) throw new BusinessRuleException("users.unitUnavailable", missing);
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

    /// <summary>
    /// A non-administrator may only manage (edit, lock, set permissions, reset the password, delete) an account that stays inside what the
    /// manager holds: every company unit of the account is one of the manager's units, and every action and special right of the account is
    /// one the manager has too. Otherwise a branch user manager could reset the password of a wider account (another unit, more rights) and
    /// sign in as it.
    /// </summary>
    public async Task EnsureCanManageAccountAsync(int actorUserId, int targetUserId, CancellationToken ct)
    {
        if (await permissions.IsAdminAsync(actorUserId, ct)) return;
        var mine = await UnitsOfAsync(actorUserId, ct);
        var theirs = await UnitsOfAsync(targetUserId, ct);
        // Rights may differ per unit (a role per unit), so the account is compared unit by unit with the manager's rights there.
        var outside = theirs.Order(StringComparer.Ordinal).FirstOrDefault(code => !mine.Contains(code));
        UncoveredAccess? missing = outside is null ? null : new UncoveredAccess(UncoveredAccess.Unit, outside);
        foreach (var unit in theirs.Order(StringComparer.Ordinal))
        {
            if (missing is not null) break;
            missing = AccountCoverage.FirstUncovered(mine,
                await permissions.GetEffectiveInUnitAsync(actorUserId, unit, ct), await permissions.GetRightsInUnitAsync(actorUserId, unit, ct),
                [unit], await permissions.GetEffectiveInUnitAsync(targetUserId, unit, ct), await permissions.GetRightsInUnitAsync(targetUserId, unit, ct));
        }
        switch (missing?.Kind)
        {
            case UncoveredAccess.Unit:
                throw new ForbiddenException("grant.manageUnit", missing.Code);
            case UncoveredAccess.Action:
                throw new ForbiddenException("grant.manageHigher", new Text(missing.Code), FunctionCatalog.Name(missing.Function!));
            case UncoveredAccess.Right:
                var (function, fullCode) = SpecialRightCatalog.Split(missing.Code);
                var code = SpecialRightCatalog.SplitUnit(fullCode).Code;
                var name = SpecialRightCatalog.All.FirstOrDefault(r => r.Function == function && r.Code == code)?.Name ?? code;
                throw new ForbiddenException("grant.manageHigher", name, FunctionCatalog.Name(function));
        }
    }

    /// <summary>The company units a user may work in.</summary>
    public async Task<HashSet<string>> UnitsOfAsync(int userId, CancellationToken ct) =>
        (await db.UserCompanyUnits.AsNoTracking().Where(x => x.UserId == userId).Select(x => x.UnitCode).ToListAsync(ct))
        .ToHashSet(StringComparer.Ordinal);

    /// <summary>Only administrators may change their own permissions.</summary>
    public async Task EnsureNotSelfAsync(int actorUserId, int targetUserId, CancellationToken ct)
    {
        if (actorUserId == targetUserId && !await permissions.IsAdminAsync(actorUserId, ct))
            throw new ForbiddenException("grant.self");
    }
}
