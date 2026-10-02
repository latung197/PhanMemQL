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
    Task<IReadOnlyList<ApprovalRuleDto>> GetAllAsync(string? function, CancellationToken ct);
    Task<ApprovalRuleDto> CreateAsync(int actorUserId, SaveApprovalRuleRequest request, CancellationToken ct);
    Task<ApprovalRuleDto> UpdateAsync(int actorUserId, long id, SaveApprovalRuleRequest request, CancellationToken ct);
    Task DeleteAsync(long id, CancellationToken ct);
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
    Task<DocumentApprovalDto> ApproveAsync(int userId, string unitCode, string function, string documentId, ApprovalActionRequest request, CancellationToken ct);
    Task<DocumentApprovalDto> RejectAsync(int userId, string unitCode, string function, string documentId, ApprovalActionRequest request, CancellationToken ct);

    /// <summary>The requester takes back a pending document (e.g. to edit it).</summary>
    Task<DocumentApprovalDto> WithdrawAsync(int userId, string unitCode, string function, string documentId, CancellationToken ct);

    Task<DocumentApprovalDto> GetAsync(int userId, string unitCode, string function, string documentId, CancellationToken ct);
    Task<IReadOnlyList<PendingApprovalDto>> GetPendingForMeAsync(int userId, string unitCode, CancellationToken ct);
}
