using Core.Application.Common.Permissions;
using Core.Domain.Modules.Users;
using Xunit;
using static Core.Application.Common.Permissions.SpecialRightCatalog;

namespace Core.Tests.Common;

public sealed class DocumentStatusPolicyTests
{
    private static readonly ActionPermissions Clerk = new(true, true, true, false, true);
    private static readonly ActionPermissions Approver = new(true, false, false, true, true);

    private static DocumentActor Actor(ActionPermissions actions, bool isOwner, params string[] rights) =>
        new(actions, rights.ToHashSet(), isOwner);

    [Fact]
    public void OwnerEditsDraftButNotPendingWithoutRight()
    {
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Edit, DocumentStatus.Draft, Actor(Clerk, true)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Edit, DocumentStatus.Pending, Actor(Clerk, true)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Edit, DocumentStatus.Pending, Actor(Clerk, true, EditPending)).Allowed);
    }

    [Fact]
    public void ApprovedDocumentNeedsEditApprovedAndPostedCannotBeEdited()
    {
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Edit, DocumentStatus.Approved, Actor(Clerk, true, EditPending)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Edit, DocumentStatus.Approved, Actor(Clerk, true, EditApproved)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Edit, DocumentStatus.Posted, Actor(Clerk, true, EditApproved)).Allowed);
    }

    [Fact]
    public void OthersDocumentsNeedViewAll()
    {
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.View, DocumentStatus.Draft, Actor(Clerk, false)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.View, DocumentStatus.Draft, Actor(Clerk, false, ViewAll)).Allowed);
    }

    [Fact]
    public void NobodyApprovesOwnDocument()
    {
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Approve, DocumentStatus.Pending, Actor(Approver, true, ViewAll)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Approve, DocumentStatus.Pending, Actor(Approver, false, ViewAll)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Approve, DocumentStatus.Draft, Actor(Approver, false, ViewAll)).Allowed);
    }

    [Fact]
    public void PostingAndCancelFollowStatus()
    {
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Post, DocumentStatus.Pending, Actor(Clerk, true, Post)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Post, DocumentStatus.Approved, Actor(Clerk, true, Post)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Cancel, DocumentStatus.Draft, Actor(Clerk, true)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Cancel, DocumentStatus.Approved, Actor(Clerk, true)).Allowed);
        Assert.True(DocumentStatusPolicy.Check(DocumentAction.Cancel, DocumentStatus.Approved, Actor(Clerk, true, Cancel)).Allowed);
        Assert.False(DocumentStatusPolicy.Check(DocumentAction.Cancel, DocumentStatus.Posted, Actor(Clerk, true, Cancel)).Allowed);
    }
}
