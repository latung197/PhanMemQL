using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Common.Validation;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Notifications;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Approvals;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Approvals;

/// <summary>
/// Submit → level 1 … level n → approved, or rejected at any level. Each step notifies the people who
/// have to act. Voucher services call SubmitAsync when a document is sent for approval and read the
/// result (GetAsync) to set the document status.
/// </summary>
public sealed class DocumentApprovalService(CoreContext db, ApprovalResolver resolver, IPermissionService permissions,
    INotificationService notifications) : IDocumentApprovalService
{
    public async Task<DocumentApprovalDto> SubmitAsync(int userId, string unitCode, SubmitDocumentRequest request, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, request.Function, PermissionAction.CreateEdit, ct);
        var documentId = Guard.Required(request.DocumentId, 64, "mã chứng từ");
        var steps = await LatestRoundAsync(request.Function, documentId, ct);
        if (steps.Any(x => x.Status is ApprovalStepStatus.Pending or ApprovalStepStatus.Waiting))
            throw new BusinessRuleException("Chứng từ đang chờ duyệt.");
        if (steps.Count > 0 && steps.All(x => x.Status == ApprovalStepStatus.Approved))
            throw new BusinessRuleException("Chứng từ đã được duyệt.");

        var resolution = await resolver.ResolveAsync(request.Function, unitCode, userId, request.Amount, ct);
        var empty = resolution.Levels.FirstOrDefault(x => x.UserIds.Count == 0);
        if (empty is not null)
            throw new BusinessRuleException($"Cấp duyệt {empty.Level} ({empty.Label}) chưa có người duyệt hợp lệ. Hãy kiểm tra quy trình phê duyệt.");

        var round = steps.Count == 0 ? 1 : steps[0].Round + 1;
        var now = DateTime.UtcNow;
        var title = Guard.Optional(request.Title, 200, "Tiêu đề");
        var rows = resolution.Levels.Select((level, index) => new DocumentApproval
        {
            MenuId0 = request.Function, DocumentId = documentId, DocumentTitle = title, UnitCode = unitCode,
            Amount = request.Amount, Round = round, Level = level.Level, ApproverLabel = level.Label,
            ApproverUserIds = string.Join(',', level.UserIds),
            Status = index == 0 ? ApprovalStepStatus.Pending : ApprovalStepStatus.Waiting,
            RequestedByUserId = userId, RequestedAtUtc = now
        }).ToList();
        db.DocumentApprovals.AddRange(rows);
        await db.SaveChangesAsync(ct);
        await NotifyApproversAsync(userId, rows[0], ct);
        return await GetAsync(userId, unitCode, request.Function, documentId, ct);
    }

    public async Task<DocumentApprovalDto> ApproveAsync(int userId, string unitCode, string function, string documentId,
        ApprovalActionRequest request, CancellationToken ct)
    {
        var (steps, current) = await CurrentStepForAsync(userId, function, documentId, ct);
        Act(current, userId, ApprovalStepStatus.Approved, request.Note);
        var next = steps.Where(x => x.Status == ApprovalStepStatus.Waiting).OrderBy(x => x.Level).FirstOrDefault();
        if (next is not null) next.Status = ApprovalStepStatus.Pending;
        await db.SaveChangesAsync(ct);

        if (next is not null) await NotifyApproversAsync(current.RequestedByUserId, next, ct);
        else await NotifyRequesterAsync(userId, current, "success", "đã được phê duyệt", request.Note, ct);
        return await GetAsync(userId, unitCode, function, documentId, ct);
    }

    public async Task<DocumentApprovalDto> RejectAsync(int userId, string unitCode, string function, string documentId,
        ApprovalActionRequest request, CancellationToken ct)
    {
        var (steps, current) = await CurrentStepForAsync(userId, function, documentId, ct);
        Guard.Required(request.Note, 1000, "lý do từ chối");
        Act(current, userId, ApprovalStepStatus.Rejected, request.Note);
        foreach (var waiting in steps.Where(x => x.Status == ApprovalStepStatus.Waiting)) waiting.Status = ApprovalStepStatus.Cancelled;
        await db.SaveChangesAsync(ct);
        await NotifyRequesterAsync(userId, current, "danger", "bị từ chối", request.Note, ct);
        return await GetAsync(userId, unitCode, function, documentId, ct);
    }

    public async Task<DocumentApprovalDto> WithdrawAsync(int userId, string unitCode, string function, string documentId, CancellationToken ct)
    {
        var steps = await LatestRoundAsync(function, documentId, ct, tracking: true);
        var open = steps.Where(x => x.Status is ApprovalStepStatus.Pending or ApprovalStepStatus.Waiting).ToList();
        if (open.Count == 0) throw new BusinessRuleException("Chứng từ không ở trạng thái chờ duyệt.");
        if (open[0].RequestedByUserId != userId && !await permissions.IsAdminAsync(userId, ct))
            throw new ForbiddenException("Chỉ người trình duyệt mới được rút lại chứng từ.");
        foreach (var step in open) step.Status = ApprovalStepStatus.Cancelled;
        await db.SaveChangesAsync(ct);
        return await GetAsync(userId, unitCode, function, documentId, ct);
    }

    public async Task<DocumentApprovalDto> GetAsync(int userId, string unitCode, string function, string documentId, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, function, PermissionAction.View, ct);
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
            ?? throw new BusinessRuleException("Chứng từ không ở trạng thái chờ duyệt.");
        if (current.RequestedByUserId == userId) throw new ForbiddenException("Không được tự duyệt chứng từ do mình trình.");
        if (!current.ApproverIds.Contains(userId))
            throw new ForbiddenException($"Bạn không phải người duyệt cấp {current.Level} của chứng từ này.");
        await permissions.EnsureAllowedAsync(userId, function, PermissionAction.Approve, ct);
        return (steps, current);
    }

    private static void Act(DocumentApproval step, int userId, string status, string? note)
    {
        step.Status = status;
        step.ActedByUserId = userId;
        step.ActedAtUtc = DateTime.UtcNow;
        step.Note = note?.Trim();
    }

    private async Task NotifyApproversAsync(int fromUserId, DocumentApproval step, CancellationToken ct)
    {
        foreach (var approverId in step.ApproverIds)
            await notifications.PublishAsync(fromUserId, new PublishNotificationRequest(
                $"Chờ duyệt: {step.DocumentTitle ?? step.DocumentId}",
                $"{FunctionName(step.MenuId0)} {step.DocumentId} cần bạn phê duyệt (cấp {step.Level})."
                + (step.Amount is decimal amount ? $" Giá trị: {amount:N0}." : string.Empty),
                "warning", ModuleOf(step.MenuId0), step.UnitCode, approverId, null, step.MenuId0, step.DocumentId), ct);
    }

    private async Task NotifyRequesterAsync(int fromUserId, DocumentApproval step, string type, string result, string? note,
        CancellationToken ct) =>
        await notifications.PublishAsync(fromUserId, new PublishNotificationRequest(
            $"{step.DocumentTitle ?? step.DocumentId} {result}",
            $"{FunctionName(step.MenuId0)} {step.DocumentId} {result} ở cấp {step.Level}." + (string.IsNullOrWhiteSpace(note) ? string.Empty : $" Ghi chú: {note}"),
            type, ModuleOf(step.MenuId0), step.UnitCode, step.RequestedByUserId, null, step.MenuId0, step.DocumentId), ct);

    private static string FunctionName(string function) =>
        FunctionCatalog.Functions.GetValueOrDefault(function, function);

    /// <summary>Frontend module of a function code, for the notification link.</summary>
    private static string? ModuleOf(string function) => function.Split('_')[0] switch
    {
        "inv" => "inventory", "sales" => "sales", "fin" => "finance", "hr" => "hr", _ => null
    };
}
