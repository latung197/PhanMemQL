using Core.Application.Common.Exceptions;
using Core.Domain.Modules.Users;

namespace Core.Application.Common.Permissions;

/// <summary>Builds and checks the per-function matrix the frontend expects (every catalog code present).</summary>
public static class PermissionMatrix
{
    public static Dictionary<string, ActionPermissions> Uniform(ActionPermissions value) =>
        FunctionCatalog.Functions.Keys.ToDictionary(code => code, _ => value, StringComparer.Ordinal);

    /// <summary>Fills missing codes with no rights; grants for the same code are combined (OR).</summary>
    public static Dictionary<string, ActionPermissions> Build(IEnumerable<(string Code, ActionPermissions Actions)> grants)
    {
        var matrix = Uniform(ActionPermissions.None);
        foreach (var (code, actions) in grants)
            if (matrix.TryGetValue(code, out var current))
                matrix[code] = Combine(current, actions);
        return matrix;
    }

    /// <summary>
    /// The one rule for effective rights: admins get everything; otherwise the user's own matrix,
    /// or, when the user has none, the combined matrix of the assigned roles.
    /// </summary>
    public static Dictionary<string, ActionPermissions> Resolve(bool isAdmin,
        IReadOnlyCollection<(string Code, ActionPermissions Actions)> own,
        IEnumerable<(string Code, ActionPermissions Actions)> fromRoles)
    {
        if (isAdmin) return Uniform(ActionPermissions.Full);
        return Build(own.Count > 0 ? own : fromRoles);
    }

    public static ActionPermissions Combine(ActionPermissions a, ActionPermissions b) => new(
        a.View || b.View, a.CreateEdit || b.CreateEdit, a.Delete || b.Delete,
        a.Approve || b.Approve, a.PrintExport || b.PrintExport);

    /// <summary>
    /// Special rights follow the matrix: the user's own set when the user has an own matrix,
    /// otherwise the rights of the assigned roles. Admins have every right.
    /// </summary>
    public static IReadOnlySet<string> ResolveRights(bool isAdmin, bool hasOwnMatrix,
        IEnumerable<string> own, IEnumerable<string> fromRoles)
    {
        if (isAdmin) return SpecialRightCatalog.Keys;
        return (hasOwnMatrix ? own : fromRoles).Where(SpecialRightCatalog.IsKnown).ToHashSet(StringComparer.Ordinal);
    }

    public static void EnsureKnownRights(IEnumerable<string>? rights)
    {
        var unknown = rights?.FirstOrDefault(key => !SpecialRightCatalog.IsKnown(key));
        if (unknown is not null)
            throw new BusinessRuleException($"Quyền đặc biệt không hợp lệ: {unknown}.");
    }

    /// <summary>Rejects unknown function codes so every row links to a catalog function.</summary>
    public static void EnsureKnownCodes(IReadOnlyDictionary<string, ActionPermissions>? permissions)
    {
        var unknown = permissions?.Keys.FirstOrDefault(code => !FunctionCatalog.IsFunction(code));
        if (unknown is not null)
            throw new BusinessRuleException($"Mã chức năng không hợp lệ: {unknown}.");
    }
}
