using Core.Application.Common.Localization;
using Core.Domain.Modules.Users;

namespace Core.Application.Common.Permissions;

/// <summary>Life cycle of every voucher: Lập → Chờ duyệt → Đã duyệt → Đã ghi sổ, or Hủy.</summary>
public enum DocumentStatus
{
    Draft,
    Pending,
    Approved,
    Posted,
    Cancelled
}

public enum DocumentAction
{
    View,
    Edit,
    Submit,
    Approve,
    Reject,
    Post,
    Unpost,
    Cancel
}

/// <summary>
/// Rights of one user on one voucher function, plus whether they created the document. ApproveOnScreen = the
/// "Duyệt" right on an approval screen of the voucher (VoucherCatalog.ApprovalScreens).
/// </summary>
public sealed record DocumentActor(ActionPermissions Actions, IReadOnlySet<string> Rights, bool IsOwner,
    bool ApproveOnScreen = false)
{
    public bool Has(string rightCode) => Rights.Contains(rightCode);

    public bool CanApprove => Actions.Approve || ApproveOnScreen;

    /// <summary>The actor as voucher services build it: matrix and special rights from IPermissionService.</summary>
    public static DocumentActor For(IReadOnlyDictionary<string, ActionPermissions> matrix, IReadOnlySet<string> rights,
        string function, bool isOwner)
    {
        var actions = matrix.GetValueOrDefault(function) ?? ActionPermissions.None;
        var prefix = function + ":";
        var codes = rights.Where(x => x.StartsWith(prefix, StringComparison.Ordinal)).Select(x => x[prefix.Length..])
            .ToHashSet(StringComparer.Ordinal);
        return new DocumentActor(actions, codes, isOwner,
            !actions.Approve && PermissionMatrix.CanApprove(matrix, function));
    }
}

public sealed record PolicyDecision(bool Allowed, string? Reason = null)
{
    public static PolicyDecision Allow { get; } = new(true);
    /// <summary>Refusal with the reason in the language of the request (<paramref name="reasonKey"/>: policy.* message).</summary>
    public static PolicyDecision Deny(string reasonKey) => new(false, Messages.T(reasonKey));
}

/// <summary>
/// Which document actions are allowed in which status. Voucher services call Check before changing a
/// document; the frontend mirrors these rules to enable buttons (Frontend/src/utils/documentPolicy.ts,
/// keep both in step). Enum names travel as strings in JSON ("Draft", "Pending"...).
/// Approve / Reject also require the user to be an approver of the current level (DocumentApprovalService); they
/// need neither "Xem" on the voucher nor VIEW_ALL, so an approver working from an approval screen can act.
/// </summary>
public static class DocumentStatusPolicy
{
    public static PolicyDecision Check(DocumentAction action, DocumentStatus status, DocumentActor actor)
    {
        var a = actor.Actions;
        if (action is DocumentAction.Approve or DocumentAction.Reject)
            return status != DocumentStatus.Pending ? PolicyDecision.Deny("policy.notPending")
                : actor.IsOwner ? PolicyDecision.Deny("policy.ownVoucher")
                : actor.CanApprove ? PolicyDecision.Allow : PolicyDecision.Deny("policy.noApproveRight");

        if (!a.View) return PolicyDecision.Deny("policy.noViewRight");
        if (!actor.IsOwner && !actor.Has(SpecialRightCatalog.ViewAll))
            return PolicyDecision.Deny("policy.ownOnly");

        return action switch
        {
            DocumentAction.View => PolicyDecision.Allow,

            DocumentAction.Edit => status switch
            {
                DocumentStatus.Draft => a.Edit ? PolicyDecision.Allow : PolicyDecision.Deny("policy.noEditRight"),
                DocumentStatus.Pending => a.Edit && actor.Has(SpecialRightCatalog.EditPending)
                    ? PolicyDecision.Allow : PolicyDecision.Deny("policy.editPending"),
                DocumentStatus.Approved => a.Edit && actor.Has(SpecialRightCatalog.EditApproved)
                    ? PolicyDecision.Allow : PolicyDecision.Deny("policy.editApproved"),
                DocumentStatus.Posted => PolicyDecision.Deny("policy.postedNoEdit"),
                _ => PolicyDecision.Deny("policy.cancelled")
            },

            DocumentAction.Submit => status == DocumentStatus.Draft && (a.Create || a.Edit)
                ? PolicyDecision.Allow : PolicyDecision.Deny("policy.submitDraftOnly"),

            DocumentAction.Post => status == DocumentStatus.Approved && actor.Has(SpecialRightCatalog.Post)
                ? PolicyDecision.Allow : PolicyDecision.Deny("policy.postApprovedOnly"),

            DocumentAction.Unpost => status == DocumentStatus.Posted && actor.Has(SpecialRightCatalog.Unpost)
                ? PolicyDecision.Allow : PolicyDecision.Deny("policy.unpostRight"),

            DocumentAction.Cancel => status switch
            {
                DocumentStatus.Posted => PolicyDecision.Deny("policy.postedNoCancel"),
                DocumentStatus.Cancelled => PolicyDecision.Deny("policy.cancelled"),
                DocumentStatus.Draft when actor.IsOwner && a.Delete => PolicyDecision.Allow,
                _ => actor.Has(SpecialRightCatalog.Cancel) ? PolicyDecision.Allow : PolicyDecision.Deny("policy.cancelRight")
            },

            _ => PolicyDecision.Deny("policy.invalidAction")
        };
    }
}
