using Core.Application.Common.Auditing;
using Core.Domain.Modules.Users;
using Xunit;

namespace Core.Tests.Common;

public sealed class AuditDiffTests
{
    private static readonly ActionPermissions ViewOnly = new(true, false, false, false, false);
    private static readonly ActionPermissions ViewEdit = new(true, true, false, false, false);

    [Fact]
    public void FieldSkipsUnchangedValuesAndTreatsEmptyAsNoValue()
    {
        var changes = new AuditDiff()
            .Field("name", "A", "A")
            .Field("note", "", null)
            .Field("email", null, "a@b.vn")
            .Field("isActive", true, false)
            .Field("minAmount", 1000.5m, 2000m)
            .Changes;

        Assert.Equal([
            new AuditChange("email", null, "a@b.vn"),
            new AuditChange("isActive", "true", "false"),
            new AuditChange("minAmount", "1000.5", "2000")
        ], changes);
    }

    [Fact]
    public void FieldsComparesTwoSnapshotsAndCreateOrDeleteHaveOneSideOnly()
    {
        var before = new Dictionary<string, object?> { ["code"] = "KT", ["units"] = new List<string> { "DV1" } };
        var after = new Dictionary<string, object?> { ["code"] = "KT", ["units"] = new List<string> { "DV1", "DV2" } };

        Assert.Equal([new AuditChange("units", "DV1", "DV1, DV2")], new AuditDiff().Fields(before, after).Changes);
        Assert.Equal([new AuditChange("code", null, "KT"), new AuditChange("units", null, "DV1")],
            new AuditDiff().Fields(null, before).Changes);
        Assert.Equal([new AuditChange("code", "KT", null), new AuditChange("units", "DV1", null)],
            new AuditDiff().Fields(before, null).Changes);
    }

    [Fact]
    public void MatrixListsGrantedActionsPerChangedFunction()
    {
        var before = new Dictionary<string, ActionPermissions> { ["inv_receipt"] = ViewOnly, ["inv_issue"] = ViewOnly };
        var after = new Dictionary<string, ActionPermissions>
        {
            ["inv_receipt"] = ViewEdit, ["inv_issue"] = ViewOnly, ["sys_users"] = ActionPermissions.None
        };

        Assert.Equal([new AuditChange("permission:inv_receipt", "view", "view,createEdit")],
            new AuditDiff().Matrix(before, after).Changes);
        Assert.Equal([new AuditChange("permission:inv_issue", "view", null), new AuditChange("permission:inv_receipt", "view", null)],
            new AuditDiff().Matrix(before, null).Changes);
    }

    [Fact]
    public void RightsLogsGrantedAndRemovedRights()
    {
        var changes = new AuditDiff().Rights(["inv_receipt:VIEW_PRICE", "inv_receipt:POST"], ["inv_receipt:POST", "inv_issue:POST"])
            .Changes;

        Assert.Equal([
            new AuditChange("right:inv_issue:POST", "false", "true"),
            new AuditChange("right:inv_receipt:VIEW_PRICE", "true", "false")
        ], changes);
    }

    [Fact]
    public void ActionListIsNullWithoutRights()
    {
        Assert.Null(AuditDiff.ActionList(ActionPermissions.None));
        Assert.Null(AuditDiff.ActionList(null));
        Assert.Equal("view,createEdit,delete,approve,printExport", AuditDiff.ActionList(ActionPermissions.Full));
    }
}
