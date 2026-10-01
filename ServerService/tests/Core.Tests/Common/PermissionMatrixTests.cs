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
        Assert.Equal(ActionPermissions.None, matrix["hr_list"]);
    }

    [Fact]
    public void LandingPageIsAlwaysViewable()
    {
        // Not granted by any role, and even taken away by an own row: still viewable, nothing more.
        Assert.Equal(ViewOnly, PermissionMatrix.Resolve(false, [], [])["overview_main"]);
        Assert.Equal(ViewOnly, PermissionMatrix.Resolve(false, [("overview_main", ActionPermissions.None)], [])["overview_main"]);
        Assert.Equal(ViewOnly, PermissionMatrix.Build([])["overview_main"]);
    }

    [Fact]
    public void ApprovalScreensApproveTheirVouchers()
    {
        var approve = new ActionPermissions(true, false, false, true, false);
        var matrix = PermissionMatrix.Resolve(false, [], [("inv_approve_transfer", approve)]);
        Assert.True(PermissionMatrix.CanApprove(matrix, "inv_transfer_order"));
        Assert.True(PermissionMatrix.CanApprove(matrix, "inv_transfer_receipt"));
        Assert.True(PermissionMatrix.CanViewForApproval(matrix, "inv_transfer_issue"));
        // Another voucher, or a screen that only views, does not approve.
        Assert.False(PermissionMatrix.CanApprove(matrix, "inv_receipt"));
        Assert.False(PermissionMatrix.CanApprove(PermissionMatrix.Resolve(false, [], [("inv_approve_receipt", ViewOnly)]), "inv_receipt"));
        // Vouchers without an approval screen: only "Duyệt" on the voucher itself.
        Assert.True(PermissionMatrix.CanApprove(PermissionMatrix.Resolve(false, [], [("sales_orders", approve)]), "sales_orders"));
    }

    [Fact]
    public void ApprovalScreensPointToCatalogVouchers()
    {
        foreach (var (screen, vouchers) in Core.Application.Common.Documents.VoucherCatalog.ApprovalScreens)
        {
            Assert.True(FunctionCatalog.IsFunction(screen), screen);
            Assert.All(vouchers, v => Assert.NotNull(Core.Application.Common.Documents.VoucherCatalog.FindByFunction(v)));
        }
    }

    [Fact]
    public void SpecialRightsCountOnlyOnViewableFunctions()
    {
        var matrix = PermissionMatrix.Resolve(false, [], [("inv_receipt", ViewOnly), ("inv_issue", EditOnly)]);
        var receiptPrice = SpecialRightCatalog.Key("inv_receipt", SpecialRightCatalog.ViewPrice);
        var issuePrice = SpecialRightCatalog.Key("inv_issue", SpecialRightCatalog.ViewPrice);
        var send = SpecialRightCatalog.Key(SpecialRightCatalog.NotificationFunction, SpecialRightCatalog.SendNotification);
        Assert.Equal([receiptPrice, send], PermissionMatrix.VisibleRights([receiptPrice, issuePrice, send, receiptPrice], matrix));
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
