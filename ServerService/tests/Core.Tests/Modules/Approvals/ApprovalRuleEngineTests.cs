using Core.Application.Modules.Approvals;
using Core.Domain.Modules.Approvals;
using Xunit;

namespace Core.Tests.Modules.Approvals;

public sealed class ApprovalRuleEngineTests
{
    private static ApprovalRule Rule(int level, string approverRole, decimal? minAmount = null, string requesterType = RequesterTypes.Any,
        string? requesterValue = null, string? unit = null, bool active = true) => new()
    {
        MenuId0 = "inv_receipt", Level = level, ApproverType = ApproverTypes.Role, ApproverValue = approverRole,
        MinAmount = minAmount, RequesterType = requesterType, RequesterValue = requesterValue, UnitCode = unit, IsActive = active
    };

    private static readonly ApprovalRequester Clerk = new(10, [5], "Phòng Kho Vận");

    [Fact]
    public void AmountAddsHigherLevels()
    {
        ApprovalRule[] rules = [Rule(1, "TK"), Rule(2, "GD", minAmount: 50_000_000)];
        Assert.Single(ApprovalRuleEngine.Resolve(rules, "inv_receipt", "DVCS01", Clerk, 10_000_000));
        var levels = ApprovalRuleEngine.Resolve(rules, "inv_receipt", "DVCS01", Clerk, 60_000_000);
        Assert.Equal([1, 2], levels.Select(l => l.Level));
    }

    [Fact]
    public void RequesterConditionsFilterRules()
    {
        ApprovalRule[] rules =
        [
            Rule(1, "KTT", requesterType: RequesterTypes.Role, requesterValue: "5"),
            Rule(1, "HR", requesterType: RequesterTypes.Department, requesterValue: "Phòng Nhân Sự"),
            Rule(1, "TK", requesterType: RequesterTypes.User, requesterValue: "10")
        ];
        var level = Assert.Single(ApprovalRuleEngine.Resolve(rules, "inv_receipt", "DVCS01", Clerk, null));
        Assert.Equal(["KTT", "TK"], level.Approvers.Select(a => a.Value).OrderBy(x => x));
    }

    [Fact]
    public void UnitFunctionAndInactiveRulesAreRespected()
    {
        ApprovalRule[] rules = [Rule(1, "A", unit: "DVCS02"), Rule(1, "B", active: false), Rule(1, "C")];
        var level = Assert.Single(ApprovalRuleEngine.Resolve(rules, "inv_receipt", "DVCS01", Clerk, null));
        Assert.Equal("C", Assert.Single(level.Approvers).Value);
        Assert.Empty(ApprovalRuleEngine.Resolve(rules, "inv_issue", "DVCS01", Clerk, null));
    }
}
