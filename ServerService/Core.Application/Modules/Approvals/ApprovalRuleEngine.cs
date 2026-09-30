using Core.Domain.Modules.Approvals;

namespace Core.Application.Modules.Approvals;

/// <summary>The person who created the document, as seen by the rules. Department = department code.</summary>
public sealed record ApprovalRequester(int UserId, IReadOnlyCollection<int> RoleIds, string? Department);

public sealed record ApproverRef(string Type, string Value);

public sealed record ResolvedLevel(int Level, IReadOnlyList<ApproverRef> Approvers);

/// <summary>
/// Picks the rules that apply to one document and groups their approvers by level. Pure logic, no
/// database: the services expand ROLE approvers into users afterwards.
/// </summary>
public static class ApprovalRuleEngine
{
    public static IReadOnlyList<ResolvedLevel> Resolve(IEnumerable<ApprovalRule> rules, string function,
        string unitCode, ApprovalRequester requester, decimal? amount) =>
        rules.Where(r => r.IsActive && r.MenuId0 == function
                && (r.UnitCode is null || r.UnitCode == unitCode)
                && (r.MinAmount is null || (amount ?? 0) >= r.MinAmount)
                && MatchesRequester(r, requester))
            .GroupBy(r => r.Level)
            .OrderBy(g => g.Key)
            .Select(g => new ResolvedLevel(g.Key, g.Select(r => new ApproverRef(r.ApproverType, r.ApproverValue))
                .Distinct().ToList()))
            .ToList();

    private static bool MatchesRequester(ApprovalRule rule, ApprovalRequester requester) => rule.RequesterType switch
    {
        RequesterTypes.Any => true,
        RequesterTypes.User => rule.RequesterValue == requester.UserId.ToString(),
        RequesterTypes.Role => int.TryParse(rule.RequesterValue, out var roleId) && requester.RoleIds.Contains(roleId),
        RequesterTypes.Department => string.Equals(rule.RequesterValue?.Trim(), requester.Department?.Trim(),
            StringComparison.OrdinalIgnoreCase),
        _ => false
    };
}
