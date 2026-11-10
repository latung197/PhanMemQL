using Core.Application.Common.Permissions;
namespace Core.Application.Modules.Approvals;

// ----- Rules (Settings › Quy trình phê duyệt) -----

public sealed record ApprovalRuleDto(string Id, string Function, string? UnitCode, int Level, string RequesterType,
    string? RequesterValue, decimal? MinAmount, string ApproverType, string ApproverValue, string? Note, bool IsActive, uint Version);

public sealed record SaveApprovalRuleRequest(string Function, string? UnitCode, int Level, string RequesterType,
    string? RequesterValue, decimal? MinAmount, string ApproverType, string ApproverValue, string? Note, bool IsActive = true, uint? Version = null);

public sealed record ApproverUserDto(string Id, string Username, string FullName);

public sealed record ApprovalLevelPreview(int Level, string Label, IReadOnlyList<ApproverUserDto> Approvers);

/// <summary>Who will approve; UsesDefaultApprovers = no rule matched, so users with the "Duyệt" right approve.</summary>
public sealed record ApprovalPreview(bool UsesDefaultApprovers, IReadOnlyList<ApprovalLevelPreview> Levels);

public sealed record PreviewApprovalRequest(string Function, int RequesterUserId, string? UnitCode, decimal? Amount);

public interface IApprovalRuleService
{
    Task<IReadOnlyList<ApprovalRuleDto>> GetAllAsync(int actorUserId, string? function, CancellationToken ct);
    Task<ApprovalRuleDto> CreateAsync(int actorUserId, SaveApprovalRuleRequest request, CancellationToken ct);
    Task<ApprovalRuleDto> UpdateAsync(int actorUserId, long id, SaveApprovalRuleRequest request, CancellationToken ct);
    Task DeleteAsync(int actorUserId, long id, CancellationToken ct);
    Task<ApprovalPreview> PreviewAsync(PreviewApprovalRequest request, string defaultUnitCode, CancellationToken ct);
}

// ----- Running approvals of documents (used by the voucher modules) -----

/// <summary>Sends a document for approval. Amount drives the amount-based rules.</summary>
public sealed record SubmitDocumentRequest(string Function, string DocumentId, string? Title, decimal? Amount);

public sealed record ApprovalActionRequest(string? Note);

/// <param name="TargetStatus">The voucher status the level leads to (Approved1, Approved2, Approved).</param>
public sealed record ApprovalStepDto(int Level, string Status, string ApproverLabel, IReadOnlyList<ApproverUserDto> Approvers,
    ApproverUserDto? ActedBy, DateTime? ActedAt, string? Note, string TargetStatus = "Approved");

/// <summary>
/// Status: NONE (never submitted), PENDING, APPROVED, REJECTED, WITHDRAWN. CanAct = the current user may
/// approve or reject the current level.
/// </summary>
public sealed record DocumentApprovalDto(string Function, string DocumentId, string? Title, string Status, int Round,
    int? CurrentLevel, bool CanAct, ApproverUserDto? RequestedBy, DateTime? RequestedAt, IReadOnlyList<ApprovalStepDto> Steps);

public sealed record PendingApprovalDto(string Function, string DocumentId, string? Title, decimal? Amount, int Level,
    ApproverUserDto RequestedBy, DateTime RequestedAt);

public interface IDocumentApprovalService
{
    Task<DocumentApprovalDto> SubmitAsync(int userId, string unitCode, SubmitDocumentRequest request, CancellationToken ct);

    /// <summary>
    /// Approves a document in approval: the levels still open are approved, in order, as far as the user's status rights reach in the
    /// document's unit (level k needs the status it leads to: Duyệt cấp 1 / Duyệt cấp 2 / Đã duyệt, a later right includes the earlier
    /// ones), own documents too; the voucher takes the status of the last level approved and the next level is notified. Refused when
    /// the user reaches none of them.
    /// </summary>
    Task<DocumentApprovalDto> ApproveAsync(int userId, string unitCode, string function, string documentId, ApprovalActionRequest request, CancellationToken ct);

    /// <summary>Sends a document in approval back to its requester (to Draft); needs the right to approve its current level.</summary>
    Task<DocumentApprovalDto> RejectAsync(int userId, string unitCode, string function, string documentId, ApprovalActionRequest request, CancellationToken ct);

    /// <summary>
    /// The "Duyệt" button of a voucher, inside the caller's transaction: a voucher in approval goes up as <see cref="ApproveAsync"/>; a
    /// draft goes straight to the highest approval status in use that the user reaches (<see cref="ApproveDraftToAsync"/>).
    /// </summary>
    Task ApproveNextAsync(int userId, string unitCode, string function, string documentId, string? title, CancellationToken ct);

    /// <summary>
    /// Saving a draft voucher straight at <paramref name="target"/> (Approved1, Approved2 or Approved), inside the caller's transaction:
    /// a new round is opened and its levels up to the target are approved by the user (who must reach the target in the unit), the
    /// next level is notified. The target must be a status the unit uses. A unit without the approval step (Pending switched off) only
    /// takes Approved, recorded without a workflow.
    /// </summary>
    Task ApproveDraftToAsync(int userId, string unitCode, string function, string documentId, string? title, DocumentStatus target, CancellationToken ct);

    /// <summary>
    /// Takes a voucher to Approved inside the caller's transaction, whatever step it is at (before posting it): a draft has every
    /// level approved at once (or none when the unit switched the approval step off), one in approval its open levels, an approved
    /// one stays. The caller has checked the user's status right (DocumentStatusPolicy: posting reaches every level).
    /// </summary>
    Task ApproveToEndAsync(int userId, string unitCode, string function, string documentId, string? title, CancellationToken ct);

    /// <summary>The requester takes back a document in approval (e.g. to edit it).</summary>
    Task<DocumentApprovalDto> WithdrawAsync(int userId, string unitCode, string function, string documentId, CancellationToken ct);

    Task<DocumentApprovalDto> GetAsync(int userId, string unitCode, string function, string documentId, CancellationToken ct);
    Task<IReadOnlyList<PendingApprovalDto>> GetPendingForMeAsync(int userId, string unitCode, CancellationToken ct);
}
