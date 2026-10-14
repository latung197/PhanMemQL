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
        DocumentStatus.Pending => Has(SpecialRightCatalog.StatusPending) || Reaches(DocumentStatus.Approved),
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
                DocumentStatus.Pending => a.Edit && actor.Reaches(DocumentStatus.Pending)
                    ? PolicyDecision.Allow : PolicyDecision.Deny("policy.editPending"),
                DocumentStatus.Approved => a.Edit && actor.Reaches(DocumentStatus.Approved)
                    ? PolicyDecision.Allow : PolicyDecision.Deny("policy.editApproved"),
                DocumentStatus.Posted => PolicyDecision.Deny("policy.postedNoEdit"),
                _ => PolicyDecision.Deny("policy.cancelled")
            },

            DocumentAction.Submit => status != DocumentStatus.Draft || !(a.Create || a.Edit)
                ? PolicyDecision.Deny("policy.submitDraftOnly")
                : actor.Reaches(DocumentStatus.Pending) ? PolicyDecision.Allow : PolicyDecision.Deny("policy.noStatusRight"),

            DocumentAction.Post => status == DocumentStatus.Approved && actor.Reaches(DocumentStatus.Posted)
                ? PolicyDecision.Allow : PolicyDecision.Deny("policy.postApprovedOnly"),

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
/// the right to add / change; Approved with the "Duyệt" right and being an approver of every level; Posted with both and the
/// POST right), the voucher then goes through those steps in the same transaction, approvals and ledger included.
/// </summary>
public static class VoucherTargetStatus
{
    /// <summary>Empty = Draft (just save). Only Draft, Pending, Approved and Posted can be asked for.</summary>
    public static DocumentStatus Parse(string? value) => string.IsNullOrWhiteSpace(value) ? DocumentStatus.Draft : value.Trim() switch
    {
        "Draft" => DocumentStatus.Draft,
        "Pending" => DocumentStatus.Pending,
        "Approved" => DocumentStatus.Approved,
        "Posted" => DocumentStatus.Posted,
        _ => throw new Core.Application.Common.Exceptions.BusinessRuleException("saveStatus.invalid")
    };
}
