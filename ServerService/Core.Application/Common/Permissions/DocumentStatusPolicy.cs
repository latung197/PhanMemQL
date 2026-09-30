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

/// <summary>Rights of one user on one voucher function, plus whether they created the document.</summary>
public sealed record DocumentActor(ActionPermissions Actions, IReadOnlySet<string> Rights, bool IsOwner)
{
    public bool Has(string rightCode) => Rights.Contains(rightCode);
}

public sealed record PolicyDecision(bool Allowed, string? Reason = null)
{
    public static PolicyDecision Allow { get; } = new(true);
    public static PolicyDecision Deny(string reason) => new(false, reason);
}

/// <summary>
/// Which document actions are allowed in which status. Voucher services call Check before changing a
/// document; the frontend mirrors these rules to enable buttons (Frontend/src/utils/documentPolicy.ts,
/// keep both in step). Enum names travel as strings in JSON ("Draft", "Pending"...).
/// Approve / Reject also require the user to be an approver of the current level (ApprovalService).
/// </summary>
public static class DocumentStatusPolicy
{
    public static PolicyDecision Check(DocumentAction action, DocumentStatus status, DocumentActor actor)
    {
        var a = actor.Actions;
        if (!a.View) return PolicyDecision.Deny("Không có quyền xem chức năng này.");
        if (!actor.IsOwner && !actor.Has(SpecialRightCatalog.ViewAll))
            return PolicyDecision.Deny("Chỉ được thao tác trên phiếu do mình lập.");

        return action switch
        {
            DocumentAction.View => PolicyDecision.Allow,

            DocumentAction.Edit => status switch
            {
                DocumentStatus.Draft => a.CreateEdit ? PolicyDecision.Allow : PolicyDecision.Deny("Không có quyền sửa phiếu."),
                DocumentStatus.Pending => a.CreateEdit && actor.Has(SpecialRightCatalog.EditPending)
                    ? PolicyDecision.Allow : PolicyDecision.Deny("Phiếu đang chờ duyệt; cần quyền \"Sửa phiếu đang chờ duyệt\"."),
                DocumentStatus.Approved => a.CreateEdit && actor.Has(SpecialRightCatalog.EditApproved)
                    ? PolicyDecision.Allow : PolicyDecision.Deny("Phiếu đã duyệt; cần quyền \"Sửa phiếu đã duyệt\"."),
                DocumentStatus.Posted => PolicyDecision.Deny("Phiếu đã ghi sổ; phải bỏ ghi sổ trước khi sửa."),
                _ => PolicyDecision.Deny("Phiếu đã hủy.")
            },

            DocumentAction.Submit => status == DocumentStatus.Draft && a.CreateEdit
                ? PolicyDecision.Allow : PolicyDecision.Deny("Chỉ trình duyệt được phiếu đang lập."),

            DocumentAction.Approve or DocumentAction.Reject => status != DocumentStatus.Pending
                ? PolicyDecision.Deny("Phiếu không ở trạng thái chờ duyệt.")
                : actor.IsOwner ? PolicyDecision.Deny("Không được tự duyệt phiếu do mình lập.")
                : a.Approve ? PolicyDecision.Allow : PolicyDecision.Deny("Không có quyền phê duyệt."),

            DocumentAction.Post => status == DocumentStatus.Approved && actor.Has(SpecialRightCatalog.Post)
                ? PolicyDecision.Allow : PolicyDecision.Deny("Chỉ ghi sổ phiếu đã duyệt; cần quyền \"Ghi sổ\"."),

            DocumentAction.Unpost => status == DocumentStatus.Posted && actor.Has(SpecialRightCatalog.Unpost)
                ? PolicyDecision.Allow : PolicyDecision.Deny("Cần quyền \"Bỏ ghi sổ\"."),

            DocumentAction.Cancel => status switch
            {
                DocumentStatus.Posted => PolicyDecision.Deny("Phiếu đã ghi sổ; phải bỏ ghi sổ trước khi hủy."),
                DocumentStatus.Cancelled => PolicyDecision.Deny("Phiếu đã hủy."),
                DocumentStatus.Draft when actor.IsOwner && a.Delete => PolicyDecision.Allow,
                _ => actor.Has(SpecialRightCatalog.Cancel) ? PolicyDecision.Allow : PolicyDecision.Deny("Cần quyền \"Hủy phiếu\".")
            },

            _ => PolicyDecision.Deny("Thao tác không hợp lệ.")
        };
    }
}
