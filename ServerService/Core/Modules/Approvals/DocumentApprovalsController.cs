using Core.Application.Modules.Approvals;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Approvals;

/// <summary>
/// Approval of documents, shared by every voucher module. Permission checks (create/approve rights,
/// being an approver of the level, not approving one's own document) are done by the service.
/// </summary>
[Route("api/approvals")]
public sealed class DocumentApprovalsController(IDocumentApprovalService approvals) : ApiControllerBase
{
    /// <summary>Documents waiting for the current user's approval.</summary>
    [HttpGet("pending")]
    public Task<IReadOnlyList<PendingApprovalDto>> Pending(CancellationToken ct) =>
        approvals.GetPendingForMeAsync(CurrentUserId, CurrentUnitCode, ct);

    [HttpGet("{function}/{documentId}")]
    public Task<DocumentApprovalDto> Get(string function, string documentId, CancellationToken ct) =>
        approvals.GetAsync(CurrentUserId, CurrentUnitCode, function, documentId, ct);

    [HttpPost("submit")]
    public Task<DocumentApprovalDto> Submit(SubmitDocumentRequest request, CancellationToken ct) =>
        approvals.SubmitAsync(CurrentUserId, CurrentUnitCode, request, ct);

    [HttpPost("{function}/{documentId}/approve")]
    public Task<DocumentApprovalDto> Approve(string function, string documentId, ApprovalActionRequest request, CancellationToken ct) =>
        approvals.ApproveAsync(CurrentUserId, CurrentUnitCode, function, documentId, request, ct);

    [HttpPost("{function}/{documentId}/reject")]
    public Task<DocumentApprovalDto> Reject(string function, string documentId, ApprovalActionRequest request, CancellationToken ct) =>
        approvals.RejectAsync(CurrentUserId, CurrentUnitCode, function, documentId, request, ct);

    [HttpPost("{function}/{documentId}/withdraw")]
    public Task<DocumentApprovalDto> Withdraw(string function, string documentId, CancellationToken ct) =>
        approvals.WithdrawAsync(CurrentUserId, CurrentUnitCode, function, documentId, ct);
}
