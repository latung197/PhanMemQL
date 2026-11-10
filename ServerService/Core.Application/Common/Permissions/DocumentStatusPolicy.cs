using Core.Application.Common.Localization;
using Core.Domain.Modules.Users;

namespace Core.Application.Common.Permissions;

/// <summary>
/// Life cycle of every voucher: Lập → Chờ duyệt → [Duyệt cấp 1] → [Duyệt cấp 2] → Đã duyệt → Đã ghi sổ, or Hủy. The two approval
/// levels in brackets are off until a company unit switches them on in its status catalog (Settings › Trạng thái chứng từ): each one
/// in use is one more approval step, taken by whoever holds its status right (ST_APPROVED1 / ST_APPROVED2) in the voucher's unit.
/// </summary>
public enum DocumentStatus
{
    Draft,
    Pending,
    Approved1,
    Approved2,
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
    Cancel,
    /// <summary>Take a cancelled voucher back to Draft (Khôi phục).</summary>
    Reopen
}

/// <summary>
/// Rights of one user on one voucher function, plus whether they created the document. ApproveOnScreen = the
/// "Duyệt" right on an approval screen of the voucher (VoucherCatalog.ApprovalScreens). Rights holds the codes
/// of the function for the company unit of the voucher: the status rights are per unit (ST_POSTED...), the others are not.
/// </summary>
public sealed record DocumentActor(ActionPermissions Actions, IReadOnlySet<string> Rights, bool IsOwner,
    bool ApproveOnScreen = false)
{
    public bool Has(string rightCode) => Rights.Contains(rightCode);

    public bool CanApprove => Actions.Approve || ApproveOnScreen;

    /// <summary>
    /// Whether the user may take a voucher into <paramref name="status"/>: they hold its status right or the right of a later
    /// step (rights are granted up to a status, so whoever may post may also send for approval and approve).
    /// </summary>
    public bool Reaches(DocumentStatus status) => status switch
    {
        DocumentStatus.Draft => true,
        DocumentStatus.Pending => Has(SpecialRightCatalog.StatusPending) || Reaches(DocumentStatus.Approved1),
        DocumentStatus.Approved1 => Has(SpecialRightCatalog.StatusApproved1) || Reaches(DocumentStatus.Approved2),
        DocumentStatus.Approved2 => Has(SpecialRightCatalog.StatusApproved2) || Reaches(DocumentStatus.Approved),
        DocumentStatus.Approved => Has(SpecialRightCatalog.StatusApproved) || Reaches(DocumentStatus.Posted),
        DocumentStatus.Posted => Has(SpecialRightCatalog.StatusPosted),
        _ => Has(SpecialRightCatalog.StatusCancelled)
    };

    /// <summary>
    /// The actor as voucher services build it: matrix and special rights from IPermissionService, for the company unit
    /// of the voucher (a status right granted for another unit does not count).
    /// </summary>
    public static DocumentActor For(IReadOnlyDictionary<string, ActionPermissions> matrix, IReadOnlySet<string> rights,
        string function, bool isOwner, string unitCode)
    {
        var actions = matrix.GetValueOrDefault(function) ?? ActionPermissions.None;
        var prefix = function + ":";
        var codes = new HashSet<string>(StringComparer.Ordinal);
        foreach (var key in rights)
        {
            if (!key.StartsWith(prefix, StringComparison.Ordinal)) continue;
            var (code, unit) = SpecialRightCatalog.SplitUnit(key[prefix.Length..]);
            if (unit is null || string.Equals(unit, unitCode, StringComparison.Ordinal)) codes.Add(code);
        }
        return new DocumentActor(actions, codes, isOwner,
            !actions.Approve && PermissionMatrix.CanApprove(matrix, function));
    }
}

/// <summary>The approval part of the life cycle (Chờ duyệt → Duyệt cấp 1 → Duyệt cấp 2 → Đã duyệt), shared by the policy and the services.</summary>
public static class DocumentStatuses
{
    /// <summary>The statuses an approval takes a voucher to, in order; the unit uses Approved and the levels it switched on.</summary>
    public static IReadOnlyList<DocumentStatus> ApprovalChain { get; } = [DocumentStatus.Approved1, DocumentStatus.Approved2, DocumentStatus.Approved];

    /// <summary>Sent for approval and not approved to the end yet: Pending or one of the intermediate approval levels.</summary>
    public static bool InApproval(DocumentStatus status) => status is DocumentStatus.Pending or DocumentStatus.Approved1 or DocumentStatus.Approved2;

    /// <summary>Same as <see cref="InApproval(DocumentStatus)"/> for the status text kept on a voucher row.</summary>
    public static bool InApproval(string? status) => status is "Pending" or "Approved1" or "Approved2";

    /// <summary>The approval status right after <paramref name="status"/> in the full chain (a draft or pending voucher: level 1).</summary>
    public static DocumentStatus NextApproval(DocumentStatus status) => status switch
    {
        DocumentStatus.Draft or DocumentStatus.Pending => DocumentStatus.Approved1,
        DocumentStatus.Approved1 => DocumentStatus.Approved2,
        _ => DocumentStatus.Approved
    };
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
/// The status rights of the voucher's unit decide (granted up to a status, a later one includes the earlier steps): approving needs
/// the "Approved" right, posting the "Posted" right, also on one's own voucher; the approval rules only say whom to notify. Approve /
/// Reject of a pending voucher need neither "Xem" on the voucher nor VIEW_ALL, so an approver working from an approval screen can act.
/// </summary>
public static class DocumentStatusPolicy
{
    public static PolicyDecision Check(DocumentAction action, DocumentStatus status, DocumentActor actor)
    {
        var a = actor.Actions;
        // Approving is a status right like the others: whoever reaches the next approval status in the voucher's unit approves (own
        // vouchers too), a voucher in approval from an approval screen without "Xem" on the voucher, a draft straight away like saving
        // it at that status. Which levels a unit uses is not known here: the service takes the voucher to the highest level in use that
        // the user reaches (DocumentApprovalService) and refuses when there is none.
        if (action is DocumentAction.Approve or DocumentAction.Reject)
        {
            var open = DocumentStatuses.InApproval(status) || (action == DocumentAction.Approve && status == DocumentStatus.Draft);
            if (!open) return PolicyDecision.Deny("policy.notPending");
            if (status == DocumentStatus.Draft)
            {
                if (!a.View) return PolicyDecision.Deny("policy.noViewRight");
                if (!actor.IsOwner && !actor.Has(SpecialRightCatalog.ViewAll)) return PolicyDecision.Deny("policy.ownOnly");
            }
            return actor.Reaches(DocumentStatuses.NextApproval(status)) ? PolicyDecision.Allow : PolicyDecision.Deny("policy.noApproveRight");
        }

        if (!a.View) return PolicyDecision.Deny("policy.noViewRight");
        if (!actor.IsOwner && !actor.Has(SpecialRightCatalog.ViewAll))
            return PolicyDecision.Deny("policy.ownOnly");

        return action switch
        {
            DocumentAction.View => PolicyDecision.Allow,

            DocumentAction.Edit => status switch
            {
                DocumentStatus.Draft => a.Edit ? PolicyDecision.Allow : PolicyDecision.Deny("policy.noEditRight"),
                DocumentStatus.Pending or DocumentStatus.Approved1 or DocumentStatus.Approved2 => a.Edit && actor.Reaches(status)
                    ? PolicyDecision.Allow : PolicyDecision.Deny("policy.editPending"),
                DocumentStatus.Approved => a.Edit && actor.Reaches(DocumentStatus.Approved)
                    ? PolicyDecision.Allow : PolicyDecision.Deny("policy.editApproved"),
                DocumentStatus.Posted => PolicyDecision.Deny("policy.postedNoEdit"),
                _ => PolicyDecision.Deny("policy.cancelled")
            },

            DocumentAction.Submit => status != DocumentStatus.Draft || !(a.Create || a.Edit)
                ? PolicyDecision.Deny("policy.submitDraftOnly")
                : actor.Reaches(DocumentStatus.Pending) ? PolicyDecision.Allow : PolicyDecision.Deny("policy.noStatusRight"),

            // The posted right takes a draft or pending voucher through the approval to posted in one go.
            DocumentAction.Post => (status is DocumentStatus.Draft or DocumentStatus.Approved || DocumentStatuses.InApproval(status))
                && actor.Reaches(DocumentStatus.Posted) ? PolicyDecision.Allow : PolicyDecision.Deny("policy.postApprovedOnly"),

            DocumentAction.Unpost => status == DocumentStatus.Posted && actor.Has(SpecialRightCatalog.StatusUnpost)
                ? PolicyDecision.Allow : PolicyDecision.Deny("policy.unpostRight"),

            DocumentAction.Cancel => status switch
            {
                DocumentStatus.Posted => PolicyDecision.Deny("policy.postedNoCancel"),
                DocumentStatus.Cancelled => PolicyDecision.Deny("policy.cancelled"),
                DocumentStatus.Draft when actor.IsOwner && a.Delete => PolicyDecision.Allow,
                _ => actor.Reaches(DocumentStatus.Cancelled) ? PolicyDecision.Allow : PolicyDecision.Deny("policy.cancelRight")
            },

            // A cancelled voucher comes back as a draft for whoever may cancel vouchers in this unit.
            DocumentAction.Reopen => status != DocumentStatus.Cancelled ? PolicyDecision.Deny("policy.notCancelled")
                : actor.Reaches(DocumentStatus.Cancelled) ? PolicyDecision.Allow : PolicyDecision.Deny("policy.reopenRight"),

            _ => PolicyDecision.Deny("policy.invalidAction")
        };
    }

    /// <summary>
    /// Whether a user may save a new voucher straight at <paramref name="target"/> (the rights reach that status), before anything
    /// is saved. Draft is always allowed; Pending needs the right to add / change and the status right; Approved and Posted need
    /// the status right (Posted: also the voucher must be postable by <see cref="Check"/>). Approving still needs an approver.
    /// </summary>
    public static PolicyDecision CheckTarget(DocumentStatus target, DocumentActor actor)
    {
        if (target == DocumentStatus.Draft) return PolicyDecision.Allow;
        if (!(actor.Actions.Create || actor.Actions.Edit)) return PolicyDecision.Deny("policy.submitDraftOnly");
        return actor.Reaches(target) ? PolicyDecision.Allow : PolicyDecision.Deny("policy.noStatusRight");
    }
}

/// <summary>
/// The status a voucher is saved at. A user may save straight at any status their rights reach (Draft always; Pending with
/// the right to add / change; Approved with the "Approved" status right of the unit (the approval rules only name whom to notify); Posted with the
/// POST right), the voucher then goes through those steps in the same transaction, approvals and ledger included.
/// </summary>
public static class VoucherTargetStatus
{
    /// <summary>Empty = Draft (just save). Only Draft, Pending, Approved and Posted can be asked for.</summary>
    public static DocumentStatus Parse(string? value) => string.IsNullOrWhiteSpace(value) ? DocumentStatus.Draft : value.Trim() switch
    {
        "Draft" => DocumentStatus.Draft,
        "Pending" => DocumentStatus.Pending,
        "Approved1" => DocumentStatus.Approved1,
        "Approved2" => DocumentStatus.Approved2,
        "Approved" => DocumentStatus.Approved,
        "Posted" => DocumentStatus.Posted,
        _ => throw new Core.Application.Common.Exceptions.BusinessRuleException("saveStatus.invalid")
    };
}
