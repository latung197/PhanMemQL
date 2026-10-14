using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Domain.Modules.Users;
using Xunit;

namespace Core.Tests.Common;

public sealed class SpecialRightCatalogTests
{
    [Fact]
    public void EveryRightBelongsToACatalogFunctionAndFitsColumns()
    {
        Assert.All(SpecialRightCatalog.All, r =>
        {
            Assert.True(FunctionCatalog.IsFunction(r.Function), r.Function);
            Assert.InRange(r.Code.Length, 1, 50);
            Assert.Contains(r.Group, new[] { SpecialRightGroups.Data, SpecialRightGroups.Scope, SpecialRightGroups.Status, SpecialRightGroups.Feature });
        });
        Assert.Equal(SpecialRightCatalog.All.Count(x => !x.PerUnit), SpecialRightCatalog.Keys.Count);
        // Only status rights depend on the unit; their code plus "@" plus a unit code must still fit the column.
        Assert.All(SpecialRightCatalog.PerUnitRights, r =>
        {
            Assert.Equal(SpecialRightGroups.Status, r.Group);
            Assert.InRange(r.Code.Length + 1 + 20, 1, 50);
        });
    }

    [Fact]
    public void RightsFollowRolesWithExceptionsAndAdminHasAll()
    {
        var key = SpecialRightCatalog.Key("inv_receipt", SpecialRightCatalog.ViewPrice);
        Assert.Equal(SpecialRightCatalog.Keys.Count, PermissionMatrix.ResolveRights(true, [], [], []).Count);
        Assert.Equal(SpecialRightCatalog.Keys.Count + 2 * SpecialRightCatalog.PerUnitRights.Count(),
            PermissionMatrix.ResolveRights(true, [], [], [], ["DVCS01", "DVCS02"]).Count);
        Assert.Contains(key, PermissionMatrix.ResolveRights(false, [key], [], []));
        Assert.Empty(PermissionMatrix.ResolveRights(false, [key], [], [key]));
        Assert.Contains(key, PermissionMatrix.ResolveRights(false, [], [key], []));
        Assert.Empty(PermissionMatrix.ResolveRights(false, [], ["inv_receipt:FLY"], []));
        Assert.Throws<BusinessRuleException>(() => PermissionMatrix.EnsureKnownRights(["inv_receipt:FLY"]));
    }

    [Fact]
    public void StatusRightsAreGrantedPerUnit()
    {
        var posted = SpecialRightCatalog.UnitKey("inv_receipt", SpecialRightCatalog.StatusPosted, "DVCS01");
        Assert.Equal("inv_receipt:ST_POSTED@DVCS01", posted);
        Assert.True(SpecialRightCatalog.IsKnown(posted));
        // Without a unit a per-unit right does not exist; a right without a unit does not take one.
        Assert.False(SpecialRightCatalog.IsKnown("inv_receipt:ST_POSTED"));
        Assert.False(SpecialRightCatalog.IsKnown("inv_receipt:ST_POSTED@"));
        Assert.False(SpecialRightCatalog.IsKnown("inv_receipt:VIEW_PRICE@DVCS01"));
        Assert.False(SpecialRightCatalog.IsKnown("inv_receipt:FLY@DVCS01"));
        Assert.Equal(("ST_POSTED", "DVCS01"), SpecialRightCatalog.SplitUnit("ST_POSTED@DVCS01"));
        Assert.Equal(("VIEW_PRICE", (string?)null), SpecialRightCatalog.SplitUnit("VIEW_PRICE"));
        // A voucher that never posts has no posting rights.
        Assert.DoesNotContain(SpecialRightCatalog.All, r => r.Function == "inv_issue_request" && r.Code is "ST_POSTED" or "ST_UNPOST");
        Assert.Contains(SpecialRightCatalog.All, r => r.Function == "inv_issue" && r.Code == "ST_POSTED");
        // Changing or deleting a posted voucher is a per-unit right of the vouchers that post (goods receipt / issue, transfer issue / receipt), not of the others.
        foreach (var fn in new[] { "inv_receipt", "inv_issue", "inv_transfer_issue", "inv_transfer_receipt" })
            Assert.Contains(SpecialRightCatalog.All, r => r.Function == fn && r.Code == SpecialRightCatalog.StatusEditPosted && r.PerUnit);
        Assert.DoesNotContain(SpecialRightCatalog.All, r => r.Function is "inv_issue_request" or "inv_transfer_order" or "pur_order" && r.Code == SpecialRightCatalog.StatusEditPosted);
    }

    [Fact]
    public void InitialRightsKeepWhatUsersCouldSee()
    {
        var matrix = new Dictionary<string, ActionPermissions>
        {
            ["inv_receipt"] = new(true, true, true, false, false, true, true),
            ["inv_issue"] = new(false, false, false, false, false, false, false)
        };
        var granted = SpecialRightCatalog.InitialFor(matrix).Select(r => SpecialRightCatalog.Key(r.Function, r.Code)).ToList();
        Assert.Contains("inv_receipt:VIEW_PRICE", granted);
        Assert.Contains("inv_receipt:VIEW_ALL", granted);
        Assert.DoesNotContain(granted, k => k.Contains(":ST_"));
        Assert.DoesNotContain(granted, k => k.StartsWith("inv_issue:"));
    }

    [Fact]
    public void SendingNotificationsIsNeverGrantedAutomatically()
    {
        var matrix = new Dictionary<string, ActionPermissions>
        {
            [SpecialRightCatalog.NotificationFunction] = new(true, true, true, true, true, true, true)
        };
        Assert.DoesNotContain(SpecialRightCatalog.InitialFor(matrix), r => r.Group == SpecialRightGroups.Feature);
        Assert.True(SpecialRightCatalog.IsKnown(SpecialRightCatalog.Key(
            SpecialRightCatalog.NotificationFunction, SpecialRightCatalog.SendNotification)));
    }
}
