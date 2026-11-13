using Core.Application.Common.Permissions;
using Core.Domain.Modules.Users;
using Xunit;
using static Core.Application.Common.Permissions.SpecialRightCatalog;

namespace Core.Tests.Common;

public sealed class DocumentStatusPolicyTests
{
    private static readonly ActionPermissions Clerk = new(true, true, true, true, false, true, true);
    private static readonly ActionPermissions Approver = new(true, false, false, false, true, true, true);

    private static DocumentActor Actor(ActionPermissions actions, bool isOwner, params string[] rights) =>
        new(actions, rights.ToHashSet(), isOwner);

    [Fact]
    public void OwnerEditsDraftButNotPendingWithoutRight()
    {
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Edit, DocumentStatus.Draft, Actor(Clerk, true)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Edit, DocumentStatus.Pending, Actor(Clerk, true)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Edit, DocumentStatus.Pending, Actor(Clerk, true, StatusPending)).Allowed);
    }

    [Fact]
    public void ApprovedDocumentNeedsTheApprovedRightAndPostedCannotBeEdited()
    {
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Edit, DocumentStatus.Approved, Actor(Clerk, true, StatusPending)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Edit, DocumentStatus.Approved, Actor(Clerk, true, StatusApproved)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Edit, DocumentStatus.Posted, Actor(Clerk, true, StatusApproved)).Allowed);
    }

    [Fact]
    public void OthersDocumentsNeedViewAll()
    {
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.View, DocumentStatus.Draft, Actor(Clerk, false)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.View, DocumentStatus.Draft, Actor(Clerk, false, ViewAll)).Allowed);
    }

    [Fact]
    public void ApprovingIsTheApprovedStatusRightOwnDocumentsToo()
    {
        // The "Duyệt" action alone does not approve any more: the status right of the unit does, for one's own voucher as well.
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Approve, DocumentStatus.Pending, Actor(Approver, false, ViewAll)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Approve, DocumentStatus.Pending, Actor(Clerk, true, StatusApproved)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Approve, DocumentStatus.Pending, Actor(Clerk, false, StatusPosted)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Approve, DocumentStatus.Draft, Actor(Clerk, true, StatusApproved)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Approve, DocumentStatus.Draft, Actor(Clerk, false, StatusApproved)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Approve, DocumentStatus.Approved, Actor(Clerk, true, StatusApproved)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Reject, DocumentStatus.Pending, Actor(Clerk, true, StatusApproved)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Reject, DocumentStatus.Pending, Actor(Approver, false, StatusPending)).Allowed);
    }

    [Fact]
    public void PostingAndCancelFollowStatus()
    {
        // The posted right takes a draft or pending voucher through the approval to posted.
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Post, DocumentStatus.Draft, Actor(Clerk, true, StatusPosted)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Post, DocumentStatus.Pending, Actor(Clerk, true, StatusPosted)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Post, DocumentStatus.Pending, Actor(Clerk, true, StatusApproved)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Post, DocumentStatus.Approved, Actor(Clerk, true, StatusPosted)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Post, DocumentStatus.Posted, Actor(Clerk, true, StatusPosted)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Cancel, DocumentStatus.Draft, Actor(Clerk, true)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Cancel, DocumentStatus.Approved, Actor(Clerk, true)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Cancel, DocumentStatus.Approved, Actor(Clerk, true, StatusCancelled)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Cancel, DocumentStatus.Posted, Actor(Clerk, true, StatusCancelled)).Allowed);
    }

    [Fact]
    public void RightsAreGrantedUpToAStatusSoALaterRightIncludesTheEarlierSteps()
    {
        var pending = Actor(Clerk, true, StatusPending);
        var approved = Actor(Clerk, true, StatusApproved);
        var posted = Actor(Clerk, true, StatusPosted);
        Assert.True(pending.Reaches(DocumentStatus.Pending));
        Assert.False(pending.Reaches(DocumentStatus.Approved));
        Assert.True(approved.Reaches(DocumentStatus.Pending));
        Assert.True(approved.Reaches(DocumentStatus.Approved));
        Assert.False(approved.Reaches(DocumentStatus.Posted));
        Assert.True(posted.Reaches(DocumentStatus.Pending) && posted.Reaches(DocumentStatus.Approved) && posted.Reaches(DocumentStatus.Posted));
        // Cancelling is not a later step of the chain.
        Assert.False(posted.Reaches(DocumentStatus.Cancelled));
    }

    [Fact]
    public void ApprovalLevelsAreStatusesBetweenPendingAndApproved()
    {
        var level1 = Actor(Clerk, true, SpecialRightCatalog.StatusApproved1);
        var level2 = Actor(Clerk, true, SpecialRightCatalog.StatusApproved2);
        var approved = Actor(Clerk, true, StatusApproved);
        // Level 1 approves from Pending only; level 2 includes level 1; Approved includes both.
        Assert.True(level1.Reaches(DocumentStatus.Pending) && level1.Reaches(DocumentStatus.Approved1));
        Assert.False(level1.Reaches(DocumentStatus.Approved2));
        Assert.True(level2.Reaches(DocumentStatus.Approved1) && level2.Reaches(DocumentStatus.Approved2));
        Assert.False(level2.Reaches(DocumentStatus.Approved));
        Assert.True(approved.Reaches(DocumentStatus.Approved1) && approved.Reaches(DocumentStatus.Approved2));

        Assert.Equal(DocumentStatus.Approved1, DocumentStatuses.NextApproval(DocumentStatus.Pending));
        Assert.Equal(DocumentStatus.Approved2, DocumentStatuses.NextApproval(DocumentStatus.Approved1));
        Assert.Equal(DocumentStatus.Approved, DocumentStatuses.NextApproval(DocumentStatus.Approved2));
        Assert.True(DocumentStatuses.InApproval("Approved2"));
        Assert.False(DocumentStatuses.InApproval("Approved"));

        // The intermediate levels are off until a unit switches them on, and can be switched off again.
        Assert.False(Core.Application.Common.Documents.VoucherStatusCatalog.EnabledByDefault(DocumentStatus.Approved1));
        Assert.False(Core.Application.Common.Documents.VoucherStatusCatalog.EnabledByDefault(DocumentStatus.Approved2));
        Assert.True(Core.Application.Common.Documents.VoucherStatusCatalog.EnabledByDefault(DocumentStatus.Pending));
        Assert.True(Core.Application.Common.Documents.VoucherStatusCatalog.CanDisable(DocumentStatus.Approved1));
        Assert.False(Core.Application.Common.Documents.VoucherStatusCatalog.CanDisable(DocumentStatus.Approved));
        Assert.Equal(SpecialRightCatalog.StatusApproved2, Core.Application.Common.Documents.VoucherStatusCatalog.RightOf(DocumentStatus.Approved2));
    }

    [Fact]
    public void ASaveStraightAtAStatusNeedsTheRightsToReachIt()
    {
        Assert.True(DocumentStatusPolicy.CheckTarget(DocumentStatus.Draft, Actor(Clerk, true)).Allowed);
        Assert.False(DocumentStatusPolicy.CheckTarget(DocumentStatus.Pending, Actor(Clerk, true)).Allowed);
        Assert.True(DocumentStatusPolicy.CheckTarget(DocumentStatus.Pending, Actor(Clerk, true, StatusPending)).Allowed);
        Assert.False(DocumentStatusPolicy.CheckTarget(DocumentStatus.Approved, Actor(Clerk, true, StatusPending)).Allowed);
        Assert.True(DocumentStatusPolicy.CheckTarget(DocumentStatus.Approved, Actor(Clerk, true, StatusPosted)).Allowed);
        Assert.True(DocumentStatusPolicy.CheckTarget(DocumentStatus.Posted, Actor(Clerk, true, StatusPosted)).Allowed);
        // Someone who may not add or change vouchers cannot save at a later status at all.
        Assert.False(DocumentStatusPolicy.CheckTarget(DocumentStatus.Pending, Actor(Approver, true, StatusPosted)).Allowed);
    }

    [Fact]
    public void OnlyTheRightsOfTheVoucherUnitCount()
    {
        var matrix = new Dictionary<string, ActionPermissions> { ["inv_receipt"] = Clerk };
        var rights = new HashSet<string> { "inv_receipt:ST_POSTED@DVCS01", "inv_receipt:ST_PENDING@DVCS02", "inv_receipt:VIEW_ALL" };
        var inOne = DocumentActor.For(matrix, rights, "inv_receipt", true, "DVCS01");
        var inTwo = DocumentActor.For(matrix, rights, "inv_receipt", true, "DVCS02");
        var inThree = DocumentActor.For(matrix, rights, "inv_receipt", true, "DVCS03");
        Assert.True(inOne.Reaches(DocumentStatus.Posted) && inOne.Has(ViewAll));
        Assert.True(inTwo.Reaches(DocumentStatus.Pending) && !inTwo.Reaches(DocumentStatus.Posted));
        Assert.False(inThree.Reaches(DocumentStatus.Pending));
        Assert.True(inThree.Has(ViewAll));
    }
}
