using Core.Application.Common.Auditing;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Localization;
using Core.Application.Common.Permissions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Notifications;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Approvals;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Modules.Users;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Approvals;

/// <summary>
/// Submit → level 1 … level n → approved, or rejected at any level. Each step notifies the people who
/// have to act. Voucher services call SubmitAsync when a document is sent for approval and read the
/// result (GetAsync) to set the document status. Each step and its notifications are saved in one transaction.
/// </summary>
public sealed class DocumentApprovalService(CoreContext db, ApprovalResolver resolver, IPermissionService permissions,
    INotificationService notifications, IUnitOfWork unitOfWork, IAuditLog auditLog) : IDocumentApprovalService
{
    public async Task<DocumentApprovalDto> SubmitAsync(int userId, string unitCode, SubmitDocumentRequest request, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, request.Function, PermissionAction.CreateEdit, ct);
        var documentId = Guard.Required(request.DocumentId, 64, "field.documentId");
        var steps = await LatestRoundAsync(request.Function, documentId, ct);
        if (steps.Any(x => x.Status is ApprovalStepStatus.Pending or ApprovalStepStatus.Waiting))
            throw new BusinessRuleException("approval.pending");
        if (steps.Count > 0 && steps.All(x => x.Status == ApprovalStepStatus.Approved))
            throw new BusinessRuleException("approval.alreadyApproved");

        var resolution = await resolver.ResolveAsync(request.Function, unitCode, userId, request.Amount, ct);
        var empty = resolution.Levels.FirstOrDefault(x => x.UserIds.Count == 0);
        if (empty is not null)
            throw new BusinessRuleException("approval.emptyLevel", empty.Level, empty.Label);

        var round = steps.Count == 0 ? 1 : steps[0].Round + 1;
        var now = DateTime.UtcNow;
        var title = Guard.Optional(request.Title, 200, "field.title");
        var rows = resolution.Levels.Select((level, index) => new DocumentApproval
        {
            MenuId0 = request.Function, DocumentId = documentId, DocumentTitle = title, UnitCode = unitCode,
            Amount = request.Amount, Round = round, Level = level.Level, ApproverLabel = level.Label,
            ApproverUserIds = string.Join(',', level.UserIds),
            Status = index == 0 ? ApprovalStepStatus.Pending : ApprovalStepStatus.Waiting,
            RequestedByUserId = userId, RequestedAtUtc = now
        }).ToList();
        await unitOfWork.ExecuteAsync(async token =>
        {
            db.DocumentApprovals.AddRange(rows);
            await RecordAsync(rows[0], AuditActions.Submit, null, rows.Count, token);
            await db.SaveChangesAsync(token);
            await NotifyApproversAsync(userId, rows[0], token);
        }, ct);
        return await GetAsync(userId, unitCode, request.Function, documentId, ct);
    }

    public async Task<DocumentApprovalDto> ApproveAsync(int userId, string unitCode, string function, string documentId,
        ApprovalActionRequest request, CancellationToken ct)
    {
        var (steps, current) = await CurrentStepForAsync(userId, function, documentId, ct);
        Act(current, userId, ApprovalStepStatus.Approved, request.Note);
        var next = steps.Where(x => x.Status == ApprovalStepStatus.Waiting).OrderBy(x => x.Level).FirstOrDefault();
        if (next is not null) next.Status = ApprovalStepStatus.Pending;
        await unitOfWork.ExecuteAsync(async token =>
        {
            await RecordAsync(current, AuditActions.Approve, request.Note, steps.Count, token);
            await db.SaveChangesAsync(token);
            if (next is not null) await NotifyApproversAsync(current.RequestedByUserId, next, token);
            else await NotifyRequesterAsync(userId, current, approved: true, request.Note, token);
        }, ct);
        return await GetAsync(userId, unitCode, function, documentId, ct);
    }

    public async Task<DocumentApprovalDto> RejectAsync(int userId, string unitCode, string function, string documentId,
        ApprovalActionRequest request, CancellationToken ct)
    {
        var (steps, current) = await CurrentStepForAsync(userId, function, documentId, ct);
        Guard.Required(request.Note, 1000, "field.rejectReason");
        Act(current, userId, ApprovalStepStatus.Rejected, request.Note);
        foreach (var waiting in steps.Where(x => x.Status == ApprovalStepStatus.Waiting)) waiting.Status = ApprovalStepStatus.Cancelled;
        await unitOfWork.ExecuteAsync(async token =>
        {
            await RecordAsync(current, AuditActions.Reject, request.Note, steps.Count, token);
            await db.SaveChangesAsync(token);
            await NotifyRequesterAsync(userId, current, approved: false, request.Note, token);
        }, ct);
        return await GetAsync(userId, unitCode, function, documentId, ct);
    }

    public async Task<DocumentApprovalDto> WithdrawAsync(int userId, string unitCode, string function, string documentId, CancellationToken ct)
    {
        var steps = await LatestRoundAsync(function, documentId, ct, tracking: true);
        var open = steps.Where(x => x.Status is ApprovalStepStatus.Pending or ApprovalStepStatus.Waiting).ToList();
        if (open.Count == 0) throw new BusinessRuleException("approval.notPending");
        if (open[0].RequestedByUserId != userId && !await permissions.IsAdminAsync(userId, ct))
            throw new ForbiddenException("approval.withdrawOwnOnly");
        foreach (var step in open) step.Status = ApprovalStepStatus.Cancelled;
        await RecordAsync(open[0], AuditActions.Withdraw, null, steps.Count, ct);
        await db.SaveChangesAsync(ct);
        return await GetAsync(userId, unitCode, function, documentId, ct);
    }

    /// <summary>
    /// Approval steps are rows of sys_document_approval ([NotAudited]); the log has one entry per action on the
    /// document, under the document's function: object type = function, id = document id, level of the step.
    /// </summary>
    private Task RecordAsync(DocumentApproval step, string action, string? note, int levels, CancellationToken ct) =>
        auditLog.RecordAsync(new AuditEntry(step.MenuId0, step.MenuId0, step.DocumentId, step.DocumentTitle ?? step.DocumentId,
            action, [new AuditChange("approvalLevel", null, $"{step.Level}/{levels}")], note), ct);

    public async Task<DocumentApprovalDto> GetAsync(int userId, string unitCode, string function, string documentId, CancellationToken ct)
    {
        // Seen from the voucher or from its approval screen (Phê duyệt nhập kho...).
        if (!PermissionMatrix.CanViewForApproval(await permissions.GetEffectiveAsync(userId, ct), function))
            throw new ForbiddenException("permission.denied");
        var steps = await LatestRoundAsync(function, documentId, ct);
        if (steps.Count == 0)
            return new DocumentApprovalDto(function, documentId, null, "NONE", 0, null, false, null, null, []);

        var ids = steps.SelectMany(x => x.ApproverIds).Append(steps[0].RequestedByUserId)
            .Concat(steps.Where(x => x.ActedByUserId.HasValue).Select(x => x.ActedByUserId!.Value)).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => new ApproverUserDto(x.UserId.ToString(), x.UserName, x.FullName), ct);
        var pending = steps.FirstOrDefault(x => x.Status == ApprovalStepStatus.Pending);
        var status = steps.Any(x => x.Status == ApprovalStepStatus.Rejected) ? "REJECTED"
            : pending is not null ? "PENDING"
            : steps.All(x => x.Status == ApprovalStepStatus.Approved) ? "APPROVED" : "WITHDRAWN";

        return new DocumentApprovalDto(function, documentId, steps[0].DocumentTitle, status, steps[0].Round, pending?.Level,
            pending?.ApproverIds.Contains(userId) == true, users.GetValueOrDefault(steps[0].RequestedByUserId), steps[0].RequestedAtUtc,
            steps.Select(s => new ApprovalStepDto(s.Level, s.Status, s.ApproverLabel ?? string.Empty,
                s.ApproverIds.Where(users.ContainsKey).Select(id => users[id]).ToList(),
                s.ActedByUserId is int acted ? users.GetValueOrDefault(acted) : null, s.ActedAtUtc, s.Note)).ToList());
    }

    public async Task<IReadOnlyList<PendingApprovalDto>> GetPendingForMeAsync(int userId, string unitCode, CancellationToken ct)
    {
        var token = userId.ToString();
        var pending = await db.DocumentApprovals.AsNoTracking()
            .Where(x => x.Status == ApprovalStepStatus.Pending && x.UnitCode == unitCode
                && ("," + x.ApproverUserIds + ",").Contains("," + token + ","))
            .OrderBy(x => x.RequestedAtUtc).ToListAsync(ct);
        var requesterIds = pending.Select(x => x.RequestedByUserId).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => requesterIds.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => new ApproverUserDto(x.UserId.ToString(), x.UserName, x.FullName), ct);
        return pending.Select(x => new PendingApprovalDto(x.MenuId0, x.DocumentId, x.DocumentTitle, x.Amount, x.Level,
            users.GetValueOrDefault(x.RequestedByUserId, new ApproverUserDto(x.RequestedByUserId.ToString(), "?", "?")),
            x.RequestedAtUtc)).ToList();
    }

    private async Task<List<DocumentApproval>> LatestRoundAsync(string function, string documentId, CancellationToken ct,
        bool tracking = false)
    {
        var query = db.DocumentApprovals.Where(x => x.MenuId0 == function && x.DocumentId == documentId);
        if (!tracking) query = query.AsNoTracking();
        var round = await query.MaxAsync(x => (int?)x.Round, ct);
        return round is null ? [] : await query.Where(x => x.Round == round).OrderBy(x => x.Level).ToListAsync(ct);
    }

    /// <summary>The pending step of the document, checking that the user may act on it.</summary>
    private async Task<(List<DocumentApproval> Steps, DocumentApproval Current)> CurrentStepForAsync(int userId,
        string function, string documentId, CancellationToken ct)
    {
        var steps = await LatestRoundAsync(function, documentId, ct, tracking: true);
        var current = steps.FirstOrDefault(x => x.Status == ApprovalStepStatus.Pending)
            ?? throw new BusinessRuleException("approval.notPending");
        if (current.RequestedByUserId == userId) throw new ForbiddenException("approval.noSelfApprove");
        if (!current.ApproverIds.Contains(userId))
            throw new ForbiddenException("approval.notApproverOfLevel", current.Level);
        // "Duyệt" on the voucher or on its approval screen.
        if (!PermissionMatrix.CanApprove(await permissions.GetEffectiveAsync(userId, ct), function))
            throw new ForbiddenException("approval.noApproveRight");
        return (steps, current);
    }

    private static void Act(DocumentApproval step, int userId, string status, string? note)
    {
        step.Status = status;
        step.ActedByUserId = userId;
        step.ActedAtUtc = DateTime.UtcNow;
        step.Note = note?.Trim();
    }

    /// <summary>Each approver gets the notification in their own language.</summary>
    private async Task NotifyApproversAsync(int fromUserId, DocumentApproval step, CancellationToken ct)
    {
        var languages = await db.LanguagesOfAsync(step.ApproverIds.ToList(), ct);
        foreach (var approverId in step.ApproverIds)
        {
            var lang = languages[approverId];
            await notifications.PublishAsync(fromUserId, new PublishNotificationRequest(
                Messages.Format(lang, "approval.notify.pendingTitle", step.DocumentTitle ?? step.DocumentId),
                Messages.Format(lang, "approval.notify.pendingBody", FunctionCatalog.Name(step.MenuId0, lang), step.DocumentId, step.Level)
                + (step.Amount is decimal amount ? Messages.Format(lang, "approval.notify.amount", amount.ToString("N0")) : string.Empty),
                "warning", ModuleOf(step.MenuId0), step.UnitCode, approverId, null, step.MenuId0, step.DocumentId), ct);
        }
    }

    /// <summary>The requester learns the result (approved at the last level, or rejected) in their own language.</summary>
    private async Task NotifyRequesterAsync(int fromUserId, DocumentApproval step, bool approved, string? note, CancellationToken ct)
    {
        var lang = (await db.LanguagesOfAsync([step.RequestedByUserId], ct))[step.RequestedByUserId];
        var result = approved ? "approved" : "rejected";
        await notifications.PublishAsync(fromUserId, new PublishNotificationRequest(
            Messages.Format(lang, $"approval.notify.{result}Title", step.DocumentTitle ?? step.DocumentId),
            Messages.Format(lang, $"approval.notify.{result}Body", FunctionCatalog.Name(step.MenuId0, lang), step.DocumentId, step.Level)
            + (string.IsNullOrWhiteSpace(note) ? string.Empty : Messages.Format(lang, "approval.notify.note", note)),
            approved ? "success" : "danger", ModuleOf(step.MenuId0), step.UnitCode, step.RequestedByUserId, null, step.MenuId0, step.DocumentId), ct);
    }

    /// <summary>Frontend module of a function code, for the notification link.</summary>
    private static string? ModuleOf(string function) => function.Split('_')[0] switch
    {
        "inv" => "inventory", "sales" => "sales", "fin" => "finance", "hr" => "hr", _ => null
    };
}
