using Core.Application.Common.Permissions;
using Core.Domain.Modules.Users;
using Xunit;

namespace Core.Tests.Common;

/// <summary>A user manager who is not an administrator may only manage accounts their own units and rights cover.</summary>
public sealed class AccountCoverageTests
{
    private static readonly ActionPermissions ViewOnly = new(true, false, false, false, false, false, false);
    private static readonly ActionPermissions ViewEdit = new(true, false, true, false, false, false, false);

    private static Dictionary<string, ActionPermissions> Matrix(params (string Function, ActionPermissions Actions)[] rows) =>
        rows.ToDictionary(x => x.Function, x => x.Actions);

    [Fact]
    public void ACoveredAccountIsManageable() =>
        Assert.Null(AccountCoverage.FirstUncovered(
            new HashSet<string> { "DVCS01", "DVCS02" }, Matrix(("inv_receipt", ViewEdit)), new HashSet<string> { "inv_receipt:VIEW_PRICE" },
            ["DVCS01"], Matrix(("inv_receipt", ViewOnly)), ["inv_receipt:VIEW_PRICE"]));

    [Fact]
    public void AnAccountOfAnotherUnitIsNot()
    {
        var missing = AccountCoverage.FirstUncovered(
            new HashSet<string> { "DVCS01" }, Matrix(("inv_receipt", ViewEdit)), new HashSet<string>(),
            ["DVCS02"], Matrix(("inv_receipt", ViewOnly)), []);
        Assert.Equal(new UncoveredAccess(UncoveredAccess.Unit, "DVCS02"), missing);
    }

    [Fact]
    public void AnAccountWithAnActionTheManagerLacksIsNot()
    {
        var missing = AccountCoverage.FirstUncovered(
            new HashSet<string> { "DVCS01" }, Matrix(("inv_receipt", ViewOnly)), new HashSet<string>(),
            ["DVCS01"], Matrix(("inv_receipt", ViewEdit)), []);
        Assert.Equal(new UncoveredAccess(UncoveredAccess.Action, "action.edit", "inv_receipt"), missing);
    }

    [Fact]
    public void AnAccountWithAFunctionTheManagerDoesNotHaveIsNot()
    {
        var missing = AccountCoverage.FirstUncovered(
            new HashSet<string> { "DVCS01" }, Matrix(("inv_receipt", ViewEdit)), new HashSet<string>(),
            ["DVCS01"], Matrix(("inv_issue", ViewOnly)), []);
        Assert.Equal(new UncoveredAccess(UncoveredAccess.Action, "action.view", "inv_issue"), missing);
    }

    [Fact]
    public void AnAccountWithASpecialRightOfAnotherUnitIsNot()
    {
        // Status rights are per unit: holding ST_POSTED at DVCS01 does not cover the same right at DVCS02.
        var missing = AccountCoverage.FirstUncovered(
            new HashSet<string> { "DVCS01", "DVCS02" }, Matrix(("inv_receipt", ViewEdit)), new HashSet<string> { "inv_receipt:ST_POSTED@DVCS01" },
            ["DVCS01"], Matrix(("inv_receipt", ViewOnly)), ["inv_receipt:ST_POSTED@DVCS02"]);
        Assert.Equal(new UncoveredAccess(UncoveredAccess.Right, "inv_receipt:ST_POSTED@DVCS02"), missing);
    }
}
