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
        Assert.Equal(SpecialRightCatalog.All.Count, SpecialRightCatalog.Keys.Count);
    }

    [Fact]
    public void RightsFollowOwnMatrixOrRolesAndAdminHasAll()
    {
        var key = SpecialRightCatalog.Key("inv_receipt", SpecialRightCatalog.ViewPrice);
        Assert.Equal(SpecialRightCatalog.Keys.Count, PermissionMatrix.ResolveRights(true, false, [], []).Count);
        Assert.Contains(key, PermissionMatrix.ResolveRights(false, false, [], [key]));
        Assert.Empty(PermissionMatrix.ResolveRights(false, true, [], [key]));
        Assert.Throws<BusinessRuleException>(() => PermissionMatrix.EnsureKnownRights(["inv_receipt:FLY"]));
    }

    [Fact]
    public void InitialRightsKeepWhatUsersCouldSee()
    {
        var matrix = new Dictionary<string, ActionPermissions>
        {
            ["inv_receipt"] = new(true, true, false, false, true),
            ["inv_issue"] = new(false, false, false, false, false)
        };
        var granted = SpecialRightCatalog.InitialFor(matrix).Select(r => SpecialRightCatalog.Key(r.Function, r.Code)).ToList();
        Assert.Contains("inv_receipt:VIEW_PRICE", granted);
        Assert.Contains("inv_receipt:VIEW_ALL", granted);
        Assert.DoesNotContain("inv_receipt:POST", granted);
        Assert.DoesNotContain(granted, k => k.StartsWith("inv_issue:"));
    }

    [Fact]
    public void SendingNotificationsIsNeverGrantedAutomatically()
    {
        var matrix = new Dictionary<string, ActionPermissions>
        {
            [SpecialRightCatalog.NotificationFunction] = new(true, true, true, true, true)
        };
        Assert.DoesNotContain(SpecialRightCatalog.InitialFor(matrix), r => r.Group == SpecialRightGroups.Feature);
        Assert.True(SpecialRightCatalog.IsKnown(SpecialRightCatalog.Key(
            SpecialRightCatalog.NotificationFunction, SpecialRightCatalog.SendNotification)));
    }
}
