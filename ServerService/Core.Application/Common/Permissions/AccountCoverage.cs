using Core.Domain.Modules.Users;

namespace Core.Application.Common.Permissions;

/// <summary>What of an account a manager does not hold (the first one found): a company unit, an action of a function or a special right.</summary>
public sealed record UncoveredAccess(string Kind, string Code, string? Function = null)
{
    public const string Unit = "unit", Action = "action", Right = "right";
}

/// <summary>
/// Whether a non-administrator's own access covers an account they want to manage (edit, lock, set permissions, reset the password,
/// delete): every company unit, every action and every special right of the account must be the manager's too. Otherwise the manager
/// could take over a wider account, e.g. reset the password of a user of another unit and sign in as them. Pure rule, tested in
/// <c>AccountCoverageTests</c>; <c>GrantGuard.EnsureCanManageAccountAsync</c> applies it.
/// </summary>
public static class AccountCoverage
{
    /// <summary>The action names in the order they are checked (the keys of the action.* messages).</summary>
    public static readonly (string Key, Func<ActionPermissions, bool> Get)[] Actions =
    [
        ("action.view", a => a.View), ("action.create", a => a.Create), ("action.edit", a => a.Edit),
        ("action.delete", a => a.Delete), ("action.approve", a => a.Approve), ("action.print", a => a.Print),
        ("action.export", a => a.Export)
    ];

    /// <returns>Null when the manager covers the whole account.</returns>
    public static UncoveredAccess? FirstUncovered(
        IReadOnlySet<string> ownUnits, IReadOnlyDictionary<string, ActionPermissions> ownMatrix, IReadOnlySet<string> ownRights,
        IEnumerable<string> theirUnits, IReadOnlyDictionary<string, ActionPermissions> theirMatrix, IEnumerable<string> theirRights)
    {
        var unit = theirUnits.FirstOrDefault(code => !ownUnits.Contains(code));
        if (unit is not null) return new UncoveredAccess(UncoveredAccess.Unit, unit);

        foreach (var (function, theirs) in theirMatrix.OrderBy(x => x.Key, StringComparer.Ordinal))
        {
            var mine = ownMatrix.GetValueOrDefault(function);
            foreach (var (key, get) in Actions)
                if (get(theirs) && !(mine is not null && get(mine))) return new UncoveredAccess(UncoveredAccess.Action, key, function);
        }

        var right = theirRights.OrderBy(x => x, StringComparer.Ordinal).FirstOrDefault(key => !ownRights.Contains(key));
        return right is null ? null : new UncoveredAccess(UncoveredAccess.Right, right);
    }
}
