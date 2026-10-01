using Core.Application.Common.Documents;
using Core.Application.Common.Exceptions;
using Core.Domain.Modules.Users;

namespace Core.Application.Common.Permissions;

/// <summary>
/// Builds and checks the per-function matrix the frontend expects (every catalog code present).
/// Rights model: the user gets the rights of their roles; the user's own rows are exceptions to it.
/// An own matrix row replaces the role rights of that one function only; own special rights are grants
/// (added) or denials (removed). So a function or right added to a role later reaches every holder
/// who has no exception for it.
/// </summary>
public static class PermissionMatrix
{
    public static Dictionary<string, ActionPermissions> Uniform(ActionPermissions value) =>
        FunctionCatalog.Functions.Keys.ToDictionary(code => code, _ => value, StringComparer.Ordinal);

    /// <summary>The landing page every signed-in user may view, whatever the matrix says (as in the frontend).</summary>
    public const string LandingFunction = "overview_main";

    /// <summary>Fills missing codes with no rights; grants for the same code are combined (OR).</summary>
    public static Dictionary<string, ActionPermissions> Build(IEnumerable<(string Code, ActionPermissions Actions)> grants)
    {
        var matrix = Uniform(ActionPermissions.None);
        foreach (var (code, actions) in grants)
            if (matrix.TryGetValue(code, out var current))
                matrix[code] = Combine(current, actions);
        return WithLandingPage(matrix);
    }

    private static Dictionary<string, ActionPermissions> WithLandingPage(Dictionary<string, ActionPermissions> matrix)
    {
        if (matrix.TryGetValue(LandingFunction, out var landing) && !landing.View)
            matrix[LandingFunction] = landing with { View = true };
        return matrix;
    }

    /// <summary>
    /// Special rights only count on a function the user may view: the frontend profile, the permission checks and
    /// GrantGuard all apply this, so what the screen shows is what the API allows.
    /// </summary>
    public static List<string> VisibleRights(IEnumerable<string> rights, IReadOnlyDictionary<string, ActionPermissions> matrix) =>
        rights.Where(key => matrix.TryGetValue(SpecialRightCatalog.Split(key).Function, out var actions) && actions.View)
            .Distinct(StringComparer.Ordinal).ToList();

    /// <summary>
    /// The one rule for effective rights: admins get everything; otherwise the combined matrix of the
    /// assigned roles, with the user's own rows replacing the functions they name.
    /// </summary>
    public static Dictionary<string, ActionPermissions> Resolve(bool isAdmin,
        IReadOnlyCollection<(string Code, ActionPermissions Actions)> own,
        IEnumerable<(string Code, ActionPermissions Actions)> fromRoles)
    {
        if (isAdmin) return Uniform(ActionPermissions.Full);
        var matrix = Build(fromRoles);
        foreach (var (code, actions) in own)
            if (matrix.ContainsKey(code)) matrix[code] = actions;
        return WithLandingPage(matrix);
    }

    /// <summary>"Duyệt" on the voucher function or on one of its approval screens (VoucherCatalog.ApprovalScreens).</summary>
    public static bool CanApprove(IReadOnlyDictionary<string, ActionPermissions> matrix, string function) =>
        Allows(matrix, function, PermissionAction.Approve)
        || VoucherCatalog.ApprovalScreensOf(function).Any(screen => Allows(matrix, screen, PermissionAction.Approve));

    /// <summary>"Xem" on the voucher function or on one of its approval screens: may see the approval of a voucher.</summary>
    public static bool CanViewForApproval(IReadOnlyDictionary<string, ActionPermissions> matrix, string function) =>
        Allows(matrix, function, PermissionAction.View)
        || VoucherCatalog.ApprovalScreensOf(function).Any(screen => Allows(matrix, screen, PermissionAction.View));

    private static bool Allows(IReadOnlyDictionary<string, ActionPermissions> matrix, string function, PermissionAction action) =>
        matrix.TryGetValue(function, out var actions) && actions.Allows(action);

    public static ActionPermissions Combine(ActionPermissions a, ActionPermissions b) => new(
        a.View || b.View, a.CreateEdit || b.CreateEdit, a.Delete || b.Delete,
        a.Approve || b.Approve, a.PrintExport || b.PrintExport);

    /// <summary>Special rights: admins have all; otherwise role rights plus own grants, minus own denials.</summary>
    public static IReadOnlySet<string> ResolveRights(bool isAdmin, IEnumerable<string> fromRoles,
        IEnumerable<string> granted, IEnumerable<string> denied)
    {
        if (isAdmin) return SpecialRightCatalog.Keys;
        var rights = fromRoles.Concat(granted).Where(SpecialRightCatalog.IsKnown).ToHashSet(StringComparer.Ordinal);
        rights.ExceptWith(denied);
        return rights;
    }

    /// <summary>
    /// The exceptions to store for a user who should have <paramref name="wanted"/>: one row per function
    /// that differs from the role matrix. Functions missing from <paramref name="wanted"/> follow the role.
    /// </summary>
    public static Dictionary<string, ActionPermissions> Overrides(IReadOnlyDictionary<string, ActionPermissions> roleMatrix,
        IReadOnlyDictionary<string, ActionPermissions> wanted) =>
        wanted.Where(x => FunctionCatalog.IsFunction(x.Key) && roleMatrix.GetValueOrDefault(x.Key, ActionPermissions.None) != x.Value)
            .ToDictionary(x => x.Key, x => x.Value, StringComparer.Ordinal);

    /// <summary>Special right exceptions for a user who should have exactly <paramref name="wanted"/>.</summary>
    public static (List<string> Granted, List<string> Denied) RightOverrides(IEnumerable<string> fromRoles, IEnumerable<string> wanted)
    {
        var role = fromRoles.ToHashSet(StringComparer.Ordinal);
        var target = wanted.ToHashSet(StringComparer.Ordinal);
        return (target.Where(x => !role.Contains(x)).Order(StringComparer.Ordinal).ToList(),
            role.Where(x => !target.Contains(x)).Order(StringComparer.Ordinal).ToList());
    }

    public static void EnsureKnownRights(IEnumerable<string>? rights)
    {
        var unknown = rights?.FirstOrDefault(key => !SpecialRightCatalog.IsKnown(key));
        if (unknown is not null)
            throw new BusinessRuleException("permission.unknownRight", unknown);
    }

    /// <summary>Rejects unknown function codes so every row links to a catalog function.</summary>
    public static void EnsureKnownCodes(IReadOnlyDictionary<string, ActionPermissions>? permissions)
    {
        var unknown = permissions?.Keys.FirstOrDefault(code => !FunctionCatalog.IsFunction(code));
        if (unknown is not null)
            throw new BusinessRuleException("permission.unknownFunction", unknown);
    }
}
