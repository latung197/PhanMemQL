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

public sealed record ApprovalStepDto(int Level, string Status, string ApproverLabel, IReadOnlyList<ApproverUserDto> Approvers,
    ApproverUserDto? ActedBy, DateTime? ActedAt, string? Note);

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

    /// <summary>Approves a pending document: whoever holds the "Approved" status right of the function in its unit approves every level
    /// still open at once (own documents too; the approval rules only name whom to notify).</summary>
    Task<DocumentApprovalDto> ApproveAsync(int userId, string unitCode, string function, string documentId, ApprovalActionRequest request, CancellationToken ct);

    /// <summary>Sends a pending document back to its requester; needs the same right as approving it.</summary>
    Task<DocumentApprovalDto> RejectAsync(int userId, string unitCode, string function, string documentId, ApprovalActionRequest request, CancellationToken ct);

    /// <summary>
    /// Takes a voucher to Approved inside the caller's transaction, whatever step it is at: a draft is approved at once (one approved
    /// step per level, or none when the unit switched the approval step off), a pending one has every open level approved by the user,
    /// an approved one stays. The caller has checked the user's status right (DocumentStatusPolicy).
    /// </summary>
    Task ApproveToEndAsync(int userId, string unitCode, string function, string documentId, string? title, CancellationToken ct);

    /// <summary>The requester takes back a pending document (e.g. to edit it).</summary>
    Task<DocumentApprovalDto> WithdrawAsync(int userId, string unitCode, string function, string documentId, CancellationToken ct);

    /// <summary>Whether the user may save the voucher straight at the approved status: they hold the "Approved" status right of the
    /// function in that unit (an administrator always does). Throws otherwise.</summary>
    Task EnsureCanApproveDirectAsync(int userId, string unitCode, string function, decimal amount, CancellationToken ct);

    /// <summary>Records the approval of the whole chain by <paramref name="userId"/> at once (one step per level, all approved)
    /// and moves the draft voucher to Approved. The caller has checked <see cref="EnsureCanApproveDirectAsync"/>.</summary>
    Task ApproveDirectAsync(int userId, string unitCode, string function, string documentId, string? title, CancellationToken ct);

    /// <summary>For a unit that switched the approval step off (voucher status "Chờ duyệt"): moves the draft voucher to Approved with no
    /// approval steps and records it in the change log. The caller has checked the user's status right.</summary>
    Task ApproveWithoutFlowAsync(int userId, string unitCode, string function, string documentId, CancellationToken ct);

    Task<DocumentApprovalDto> GetAsync(int userId, string unitCode, string function, string documentId, CancellationToken ct);
    Task<IReadOnlyList<PendingApprovalDto>> GetPendingForMeAsync(int userId, string unitCode, CancellationToken ct);
}
