using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Domain.Modules.Users;
using Xunit;

namespace Core.Tests.Common;

public sealed class PermissionMatrixTests
{
    private static readonly ActionPermissions ViewOnly = new(true, false, false, false, false);
    private static readonly ActionPermissions EditOnly = new(false, true, false, false, false);

    [Fact]
    public void AdminGetsFullRightsForEveryFunction()
    {
        var matrix = PermissionMatrix.Resolve(true, [], []);
        Assert.Equal(FunctionCatalog.Functions.Count, matrix.Count);
        Assert.All(matrix.Values, actions => Assert.Equal(ActionPermissions.Full, actions));
    }

    [Fact]
    public void OwnRowReplacesOnlyItsFunction()
    {
        var matrix = PermissionMatrix.Resolve(false, [("sys_users", ViewOnly)], [("sys_users", EditOnly), ("hr_list", EditOnly)]);
        Assert.Equal(ViewOnly, matrix["sys_users"]);
        // Functions without an own row follow the role, so rights added to a role reach its holders.
        Assert.Equal(EditOnly, matrix["hr_list"]);
    }

    [Fact]
    public void OnlyDifferencesFromTheRoleAreStored()
    {
        var role = PermissionMatrix.Build([("sys_users", ViewOnly), ("hr_list", EditOnly)]);
        var wanted = new Dictionary<string, ActionPermissions>(role) { ["hr_list"] = ActionPermissions.None, ["hr_report"] = ViewOnly };
        var overrides = PermissionMatrix.Overrides(role, wanted);
        Assert.Equal(2, overrides.Count);
        Assert.Equal(ActionPermissions.None, overrides["hr_list"]);
        Assert.Equal(ViewOnly, overrides["hr_report"]);
        // Applying the exceptions to the role gives back exactly what was wanted.
        Assert.Equal(wanted, PermissionMatrix.Resolve(false, overrides.Select(x => (x.Key, x.Value)).ToList(),
            role.Select(x => (x.Key, x.Value))));
    }

    [Fact]
    public void SpecialRightsAreRoleRightsPlusGrantsMinusDenials()
    {
        var price = SpecialRightCatalog.Key("inv_receipt", SpecialRightCatalog.ViewPrice);
        var post = SpecialRightCatalog.Key("inv_receipt", SpecialRightCatalog.Post);
        var cost = SpecialRightCatalog.Key("inv_issue", SpecialRightCatalog.ViewCost);
        var (granted, denied) = PermissionMatrix.RightOverrides([price, post], [price, cost]);
        Assert.Equal([cost], granted);
        Assert.Equal([post], denied);
        Assert.Equal(new HashSet<string> { price, cost }, PermissionMatrix.ResolveRights(false, [price, post], granted, denied));
    }

    [Fact]
    public void RolesAreCombined()
    {
        var matrix = PermissionMatrix.Resolve(false, [], [("sys_users", ViewOnly), ("sys_users", EditOnly)]);
        Assert.Equal(new ActionPermissions(true, true, false, false, false), matrix["sys_users"]);
        Assert.Equal(ActionPermissions.None, matrix["overview_main"]);
    }

    [Fact]
    public void UnknownFunctionCodesAreRejected()
    {
        Assert.Throws<BusinessRuleException>(() => PermissionMatrix.EnsureKnownCodes(
            new Dictionary<string, ActionPermissions> { ["not_a_function"] = ViewOnly }));
        PermissionMatrix.EnsureKnownCodes(new Dictionary<string, ActionPermissions> { ["sys_users"] = ViewOnly });
    }

    [Fact]
    public void FunctionCodesFitTheDatabaseColumn()
    {
        Assert.All(FunctionCatalog.Functions.Keys, code => Assert.InRange(code.Length, 1, 64));
    }
}
