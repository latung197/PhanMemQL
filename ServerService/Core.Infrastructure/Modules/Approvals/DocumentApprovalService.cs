using Core.Application.Common.Auditing;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Localization;
using Core.Application.Common.Permissions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Notifications;
using Core.Application.Modules.Users;
using Core.Application.Modules.VoucherStatuses;
using Core.Domain.Common;
using Core.Domain.Modules.Approvals;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Modules.Users;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Approvals;

/// <summary>
/// Submit → level 1 … level n → approved, or rejected at any level. The levels are the approval statuses the company unit uses for the
/// voucher (Duyệt cấp 1, Duyệt cấp 2 when switched on, then Đã duyệt): approving a level moves the voucher to its status, and whoever
/// reaches a later status approves the levels on the way at once. Each step notifies the people who have to act next. Each step and
/// its notifications are saved in one transaction.
/// </summary>
public sealed class DocumentApprovalService(CoreContext db, ApprovalResolver resolver, IPermissionService permissions,
    INotificationService notifications, IUnitOfWork unitOfWork, IAuditLog auditLog, IVoucherStatusService statuses) : IDocumentApprovalService
{
    public async Task<DocumentApprovalDto> SubmitAsync(int userId, string unitCode, SubmitDocumentRequest request, CancellationToken ct)
    {
        // Whoever may add or change the document may send it (same rule as DocumentStatusPolicy Submit).
        await permissions.EnsureAnyAllowedAsync(userId, request.Function, [PermissionAction.Create, PermissionAction.Edit], ct);
        var documentId = Guard.Required(request.DocumentId, 64, "field.documentId");
        // A voucher kept in its own table (receipt, issue) must be a draft of the requester; other documents are only tracked here.
        var voucher = await FindVoucherAsync(request.Function, documentId, unitCode, ct);
        if (IsVoucherFunction(request.Function))
        {
            if (voucher is null) throw new NotFoundException(NotFoundKey(request.Function));
            if (voucher.CreatedBy != userId) throw new ForbiddenException("policy.ownOnly");
            if (voucher.Status != "Draft") throw new BusinessRuleException("policy.submitDraftOnly");
            // The same rules as the voucher's own "submit": this endpoint must not be a way around the status right of the unit
            // or the unit's choice to switch the approval step off.
            var actor = DocumentActor.For(await permissions.GetEffectiveAsync(userId, ct), await permissions.GetRightsAsync(userId, ct),
                request.Function, isOwner: true, unitCode);
            var decision = DocumentStatusPolicy.Check(DocumentAction.Submit, DocumentStatus.Draft, actor);
            if (!decision.Allowed) throw new ForbiddenException(decision.Reason ?? "permission.denied");
            await statuses.EnsureEnabledAsync(unitCode, request.Function, DocumentStatus.Pending, ct);
        }
        var steps = await LatestRoundAsync(request.Function, documentId, ct);
        if (steps.Any(x => x.Status is ApprovalStepStatus.Pending or ApprovalStepStatus.Waiting))
            throw new BusinessRuleException("approval.pending");
        // A restored voucher (cancelled, then brought back to Draft) starts a new round: the old, fully approved one does not count.
        if (steps.Count > 0 && steps.All(x => x.Status == ApprovalStepStatus.Approved) && voucher?.Status != "Draft")
            throw new BusinessRuleException("approval.alreadyApproved");

        var amount = voucher?.TotalValue ?? request.Amount;
        var rows = await NewRoundAsync(userId, unitCode, request.Function, documentId, request.Title, amount, steps, ct);
        var empty = rows.FirstOrDefault(x => x.ApproverIds.Count == 0);
        if (empty is not null) throw new BusinessRuleException("approval.emptyLevel", empty.Level, empty.ApproverLabel ?? string.Empty);
        await unitOfWork.ExecuteAsync(async token =>
        {
            db.DocumentApprovals.AddRange(rows);
            if (voucher is not null) voucher.Status = "Pending";
            await RecordAsync(rows[0], AuditActions.Submit, null, rows.Count, token);
            await db.SaveChangesAsync(token);
            await NotifyApproversAsync(userId, rows[0], token);
        }, ct);
        return await GetAsync(userId, unitCode, request.Function, documentId, ct);
    }

    /// <summary>
    /// A new round of approval steps for a document, one per approval level the unit uses (ApprovalResolver), not saved yet: level 1
    /// is Pending, the others Waiting. Each step keeps the voucher status it leads to and the people notified at that level.
    /// </summary>
    private async Task<List<DocumentApproval>> NewRoundAsync(int userId, string unitCode, string function, string documentId,
        string? title, decimal? amount, List<DocumentApproval> previous, CancellationToken ct)
    {
        var resolution = await resolver.ResolveAsync(function, unitCode, userId, amount, ct);
        var round = previous.Count == 0 ? 1 : previous[0].Round + 1;
        var now = DateTime.UtcNow;
        var cleanTitle = Guard.Optional(title, 200, "field.title");
        return resolution.Levels.Select((level, index) => new DocumentApproval
        {
            MenuId0 = function, DocumentId = documentId, DocumentTitle = cleanTitle, UnitCode = unitCode,
            Amount = amount, Round = round, Level = level.Level, ApproverLabel = level.Label,
            ApproverUserIds = string.Join(',', level.UserIds), TargetStatus = level.TargetStatus.ToString(),
            Status = index == 0 ? ApprovalStepStatus.Pending : ApprovalStepStatus.Waiting,
            RequestedByUserId = userId, RequestedAtUtc = now
        }).ToList();
    }

    public async Task<DocumentApprovalDto> ApproveAsync(int userId, string unitCode, string function, string documentId,
        ApprovalActionRequest request, CancellationToken ct)
    {
        var steps = await LatestRoundAsync(function, documentId, ct, tracking: true, unitCode: unitCode);
        var open = OpenSteps(steps);
        if (open.Count == 0 || open[0].Status != ApprovalStepStatus.Pending) throw new BusinessRuleException("approval.notPending");
        await unitOfWork.ExecuteAsync(async token =>
        {
            await ApproveStepsAsync(userId, unitCode, function, documentId, steps, open, request.Note, upTo: null, token);
        }, ct);
        return await GetAsync(userId, unitCode, function, documentId, ct);
    }

    public async Task ApproveNextAsync(int userId, string unitCode, string function, string documentId, string? title, CancellationToken ct)
    {
        var voucher = await FindVoucherAsync(function, documentId, unitCode, ct) ?? throw new NotFoundException(NotFoundKey(function));
        if (voucher.Status == "Draft")
        {
            var levels = await statuses.ApprovalLevelsAsync(unitCode, function, ct);
            var actor = await ActorAsync(userId, unitCode, function, ct);
            // The highest approval status in use that the user reaches (Approved when the unit has no approval step).
            if (levels.Count > 0 && !actor.Reaches(levels[0]))
                throw new ForbiddenException("approval.nothingToApprove", await StatusNameAsync(unitCode, function, levels[0], ct));
            var target = levels.Count == 0 ? DocumentStatus.Approved : levels.Last(actor.Reaches);
            await ApproveDraftToAsync(userId, unitCode, function, documentId, title, target, ct);
            return;
        }
        if (!DocumentStatuses.InApproval(voucher.Status)) throw new BusinessRuleException("policy.notPending");
        var steps = await LatestRoundAsync(function, documentId, ct, tracking: true, unitCode: unitCode);
        var open = OpenSteps(steps);
        if (open.Count == 0) throw new BusinessRuleException("approval.notPending");
        await ApproveStepsAsync(userId, unitCode, function, documentId, steps, open, null, upTo: null, ct);
    }

    public async Task ApproveDraftToAsync(int userId, string unitCode, string function, string documentId, string? title,
        DocumentStatus target, CancellationToken ct)
    {
        var voucher = await FindVoucherAsync(function, documentId, unitCode, ct) ?? throw new NotFoundException(NotFoundKey(function));
        if (voucher.Status != "Draft") throw new BusinessRuleException("policy.submitDraftOnly");
        var actor = await ActorAsync(userId, unitCode, function, ct);
        if (!actor.Reaches(target)) throw new ForbiddenException("approval.noApproveRight");
        var levels = await statuses.ApprovalLevelsAsync(unitCode, function, ct);
        if (levels.Count == 0)
        {
            // The unit switched the approval step off: only Approved, without a workflow.
            if (target != DocumentStatus.Approved) await statuses.EnsureEnabledAsync(unitCode, function, target, ct);
            await ApproveWithoutFlowAsync(userId, unitCode, function, documentId, ct);
            return;
        }
        if (!levels.Contains(target)) await statuses.EnsureEnabledAsync(unitCode, function, target, ct);

        var previous = await LatestRoundAsync(function, documentId, ct);
        var rows = await NewRoundAsync(userId, unitCode, function, documentId, title, voucher.TotalValue, previous, ct);
        var upTo = rows.FindLastIndex(x => x.TargetStatus == target.ToString());
        // The levels after the target still need someone to approve them.
        var empty = rows.Skip(upTo + 1).FirstOrDefault(x => x.ApproverIds.Count == 0);
        if (empty is not null) throw new BusinessRuleException("approval.emptyLevel", empty.Level, empty.ApproverLabel ?? string.Empty);
        db.DocumentApprovals.AddRange(rows);
        voucher.Status = "Pending";
        await RecordAsync(rows[0], AuditActions.Submit, null, rows.Count, ct);
        await ApproveStepsAsync(userId, unitCode, function, documentId, rows, rows, Messages.T("approval.directNote"), upTo: target, ct,
            notifyRequester: false);
        // The rest of the round goes on as usual: the next level was notified by ApproveStepsAsync.
    }

    public async Task ApproveToEndAsync(int userId, string unitCode, string function, string documentId, string? title, CancellationToken ct)
    {
        var voucher = await FindVoucherAsync(function, documentId, unitCode, ct) ?? throw new NotFoundException(NotFoundKey(function));
        if (voucher.Status == "Approved") return;
        if (voucher.Status == "Draft")
        {
            await ApproveDraftToAsync(userId, unitCode, function, documentId, title, DocumentStatus.Approved, ct);
            return;
        }
        if (!DocumentStatuses.InApproval(voucher.Status)) throw new BusinessRuleException("policy.notPending");
        var steps = await LatestRoundAsync(function, documentId, ct, tracking: true, unitCode: unitCode);
        var open = OpenSteps(steps);
        if (open.Count == 0) throw new BusinessRuleException("approval.notPending");
        await ApproveStepsAsync(userId, unitCode, function, documentId, steps, open, null, upTo: DocumentStatus.Approved, ct);
    }

    private static List<DocumentApproval> OpenSteps(List<DocumentApproval> steps) =>
        steps.Where(x => x.Status is ApprovalStepStatus.Pending or ApprovalStepStatus.Waiting).OrderBy(x => x.Level).ToList();

    /// <summary>The voucher status a step leads to (steps written before the levels followed the statuses: Approved).</summary>
    private static DocumentStatus TargetOf(DocumentApproval step) =>
        Enum.TryParse<DocumentStatus>(step.TargetStatus, out var status) ? status : DocumentStatus.Approved;

    /// <summary>
    /// Approves the open steps in order while the user reaches the status each leads to, or, with <paramref name="upTo"/>, every open
    /// step through the last one leading to that status (the user must reach it), inside the caller's transaction. The voucher takes
    /// the status of the last step approved; the next step becomes Pending and its people are notified, or the requester is told the
    /// document is approved.
    /// </summary>
    private async Task ApproveStepsAsync(int userId, string unitCode, string function, string documentId, List<DocumentApproval> steps,
        List<DocumentApproval> open, string? note, DocumentStatus? upTo, CancellationToken ct, bool notifyRequester = true)
    {
        var actor = await ActorAsync(userId, open[0].UnitCode, function, ct);
        List<DocumentApproval> taken;
        if (upTo is DocumentStatus limit)
        {
            if (!actor.Reaches(limit)) throw new ForbiddenException("approval.noApproveRight");
            var last = open.FindLastIndex(step => TargetOf(step) == limit);
            taken = last < 0 ? open : open.Take(last + 1).ToList();
        }
        else taken = open.TakeWhile(step => actor.Reaches(TargetOf(step))).ToList();
        if (taken.Count == 0)
            throw new ForbiddenException("approval.nothingToApprove", await StatusNameAsync(open[0].UnitCode, function, TargetOf(open[0]), ct));
        foreach (var step in taken) Act(step, userId, ApprovalStepStatus.Approved, note);
        var next = open.Skip(taken.Count).FirstOrDefault();
        if (next is not null) next.Status = ApprovalStepStatus.Pending;
        var reached = TargetOf(taken[^1]);
        if (IsVoucherFunction(function))
        {
            var voucher = await FindVoucherAsync(function, documentId, unitCode, ct) ?? throw new NotFoundException(NotFoundKey(function));
            voucher.Status = reached.ToString();
            if (reached == DocumentStatus.Approved) voucher.ApprovedByUserId = userId;
        }
        await RecordAsync(taken[^1], AuditActions.Approve, note, steps.Count, ct);
        await db.SaveChangesAsync(ct);
        if (next is not null) await NotifyApproversAsync(userId, next, ct);
        else if (notifyRequester && open[0].RequestedByUserId != userId) await NotifyRequesterAsync(userId, taken[^1], approved: true, note, ct);
    }

    /// <summary>The user's rights on the function in the unit (administrators hold every status right there).</summary>
    private async Task<DocumentActor> ActorAsync(int userId, string unitCode, string function, CancellationToken ct) =>
        DocumentActor.For(await permissions.GetEffectiveInUnitAsync(userId, unitCode, ct),
            await permissions.GetRightsInUnitAsync(userId, unitCode, ct), function, isOwner: false, unitCode);

    /// <summary>The name the unit gave a status of the function (for messages).</summary>
    private async Task<string> StatusNameAsync(string unitCode, string function, DocumentStatus status, CancellationToken ct)
    {
        var voucher = Core.Application.Common.Documents.VoucherCatalog.FindByFunction(function);
        if (voucher is null) return Core.Application.Common.Documents.VoucherStatusCatalog.DefaultName(status);
        var names = await statuses.GetNamesAsync(unitCode, ct);
        return names.GetValueOrDefault(voucher.VoucherType)?.GetValueOrDefault(status.ToString())?.Name
            ?? Core.Application.Common.Documents.VoucherStatusCatalog.DefaultName(status);
    }

    /// <summary>For a unit that switched the approval step off: the draft voucher goes to Approved with no approval steps, recorded in the change log.</summary>
    private async Task ApproveWithoutFlowAsync(int userId, string unitCode, string function, string documentId, CancellationToken ct)
    {
        var voucher = await FindVoucherAsync(function, documentId, unitCode, ct) ?? throw new NotFoundException(NotFoundKey(function));
        if (voucher.Status != "Draft") throw new BusinessRuleException("policy.submitDraftOnly");
        voucher.Status = "Approved";
        voucher.ApprovedByUserId = userId;
        await auditLog.RecordAsync(new AuditEntry(function, function, documentId, documentId, AuditActions.Approve, [],
            Messages.T("approval.skippedNote")), ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task<DocumentApprovalDto> RejectAsync(int userId, string unitCode, string function, string documentId,
        ApprovalActionRequest request, CancellationToken ct)
    {
        // Sending back is decided like approving: the right to approve the current level in the document's unit.
        var steps = await LatestRoundAsync(function, documentId, ct, tracking: true, unitCode: unitCode);
        var current = steps.FirstOrDefault(x => x.Status == ApprovalStepStatus.Pending)
            ?? throw new BusinessRuleException("approval.notPending");
        if (!(await ActorAsync(userId, current.UnitCode, function, ct)).Reaches(TargetOf(current)))
            throw new ForbiddenException("approval.noApproveRight");
        Guard.Required(request.Note, 1000, "field.rejectReason");
        Act(current, userId, ApprovalStepStatus.Rejected, request.Note);
        foreach (var waiting in steps.Where(x => x.Status == ApprovalStepStatus.Waiting)) waiting.Status = ApprovalStepStatus.Cancelled;
        if (IsVoucherFunction(function))
        {
            var voucher = await FindVoucherAsync(function, documentId, unitCode, ct) ?? throw new NotFoundException(NotFoundKey(function));
            voucher.Status = "Draft";
        }
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
        if (IsVoucherFunction(function))
        {
            var voucher = await FindVoucherAsync(function, documentId, unitCode, ct) ?? throw new NotFoundException(NotFoundKey(function));
            voucher.Status = "Draft";
        }
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
        var steps = await LatestRoundAsync(function, documentId, ct, unitCode: unitCode);
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

        var canAct = pending is not null && (await ActorAsync(userId, pending.UnitCode, function, ct)).Reaches(TargetOf(pending));
        return new DocumentApprovalDto(function, documentId, steps[0].DocumentTitle, status, steps[0].Round, pending?.Level,
            canAct, users.GetValueOrDefault(steps[0].RequestedByUserId), steps[0].RequestedAtUtc,
            steps.Select(s => new ApprovalStepDto(s.Level, s.Status, s.ApproverLabel ?? string.Empty,
                s.ApproverIds.Where(users.ContainsKey).Select(id => users[id]).ToList(),
                s.ActedByUserId is int acted ? users.GetValueOrDefault(acted) : null, s.ActedAtUtc, s.Note, TargetOf(s).ToString())).ToList());
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
        // The amount of a receipt / issue is a price: only for those who may see prices on that voucher.
        var hiddenAmountFunctions = new HashSet<string>();
        foreach (var function in pending.Select(x => x.MenuId0).Where(IsVoucherFunction).Distinct())
            if (!await permissions.HasRightAsync(userId, function, SpecialRightCatalog.ViewPrice, ct)) hiddenAmountFunctions.Add(function);
        return pending.Select(x => new PendingApprovalDto(x.MenuId0, x.DocumentId, x.DocumentTitle,
            hiddenAmountFunctions.Contains(x.MenuId0) ? null : x.Amount, x.Level,
            users.GetValueOrDefault(x.RequestedByUserId, new ApproverUserDto(x.RequestedByUserId.ToString(), "?", "?")),
            x.RequestedAtUtc)).ToList();
    }

    /// <summary>
    /// The right that shows the amount of a voucher: its stock cost for the vouchers the ledger values (transfer issue / receipt, stock
    /// count: VIEW_COST, as their own screens), its price for the others (VIEW_PRICE).
    /// </summary>
    private static string AmountRight(string function) => function is "inv_transfer_issue" or "inv_transfer_receipt" or "inv_audit_count"
        ? SpecialRightCatalog.ViewCost : SpecialRightCatalog.ViewPrice;

    /// <summary>Vouchers whose status this service moves with the approval steps (each has its own table).</summary>
    private static bool IsVoucherFunction(string function) => VoucherFunctions.Contains(function);

    private static readonly HashSet<string> VoucherFunctions = new(StringComparer.Ordinal)
    {
        "inv_receipt", "inv_issue", "inv_issue_request", "pur_request", "pur_order", "pur_invoice", "sales_orders",
        "inv_transfer_order", "inv_transfer_issue", "inv_transfer_receipt", "inv_audit_count",
        "pur_supplier_eval",
        // [tao-chung-tu] Chứng từ mới: thêm "mã chức năng", ngay trên dòng này (và ở NotFoundKeys, FindVoucherAsync).
    };

    private static string NotFoundKey(string function) => NotFoundKeys.GetValueOrDefault(function, "receipt.notFound");

    private static readonly Dictionary<string, string> NotFoundKeys = new(StringComparer.Ordinal)
    {
        ["inv_issue"] = "issue.notFound", ["inv_issue_request"] = "issueRequest.notFound", ["pur_request"] = "purchaseRequest.notFound",
        ["pur_order"] = "purchaseOrder.notFound", ["pur_invoice"] = "purchaseInvoice.notFound", ["sales_orders"] = "salesOrder.notFound",
        ["inv_transfer_order"] = "transferOrder.notFound", ["inv_transfer_issue"] = "transferIssue.notFound",
        ["inv_transfer_receipt"] = "transferReceipt.notFound", ["inv_audit_count"] = "stockCount.notFound",
        ["pur_supplier_eval"] = "supplierEvaluation.notFound",
        // [tao-chung-tu] Chứng từ mới: thêm ["mã chức năng"] = "loại.notFound", ngay trên dòng này.
    };

    private async Task<IApprovableDocument?> FindVoucherAsync(string function, string documentId, string unitCode, CancellationToken ct) =>
        function switch
        {
            "inv_receipt" => await db.GoodsReceipts.FirstOrDefaultAsync(x => x.Code == documentId && x.UnitCode == unitCode, ct),
            "inv_issue" => await db.GoodsIssues.FirstOrDefaultAsync(x => x.Code == documentId && x.UnitCode == unitCode, ct),
            "inv_issue_request" => await db.IssueRequests.FirstOrDefaultAsync(x => x.Code == documentId && x.UnitCode == unitCode, ct),
            "pur_request" => await db.PurchaseRequests.FirstOrDefaultAsync(x => x.Code == documentId && x.UnitCode == unitCode, ct),
            "pur_order" => await db.PurchaseOrders.FirstOrDefaultAsync(x => x.Code == documentId && x.UnitCode == unitCode, ct),
            "pur_invoice" => await db.PurchaseInvoices.FirstOrDefaultAsync(x => x.Code == documentId && x.UnitCode == unitCode, ct),
            "sales_orders" => await db.SalesOrders.FirstOrDefaultAsync(x => x.Code == documentId && x.UnitCode == unitCode, ct),
            "inv_transfer_order" => await db.TransferOrders.FirstOrDefaultAsync(x => x.Code == documentId && x.UnitCode == unitCode, ct),
            "inv_transfer_issue" => await db.TransferIssues.FirstOrDefaultAsync(x => x.Code == documentId && x.UnitCode == unitCode, ct),
            "inv_transfer_receipt" => await db.TransferReceipts.FirstOrDefaultAsync(x => x.Code == documentId && x.UnitCode == unitCode, ct),
            "inv_audit_count" => await db.StockCounts.FirstOrDefaultAsync(x => x.Code == documentId && x.UnitCode == unitCode, ct),
            "pur_supplier_eval" => await db.SupplierEvaluations.FirstOrDefaultAsync(x => x.Code == documentId && x.UnitCode == unitCode, ct),
            // [tao-chung-tu] Chứng từ mới: thêm "mã chức năng" => await db.<DbSet>.FirstOrDefaultAsync(...), ngay trên dòng này.
            _ => null
        };

    private async Task<List<DocumentApproval>> LatestRoundAsync(string function, string documentId, CancellationToken ct,
        bool tracking = false, string? unitCode = null)
    {
        var query = db.DocumentApprovals.Where(x => x.MenuId0 == function && x.DocumentId == documentId);
        // Reading the approval of a voucher is limited to the session's unit (voucher numbers are unique system-wide, so they can be guessed).
        if (unitCode is not null) query = query.Where(x => x.UnitCode == unitCode);
        if (!tracking) query = query.AsNoTracking();
        var round = await query.MaxAsync(x => (int?)x.Round, ct);
        return round is null ? [] : await query.Where(x => x.Round == round).OrderBy(x => x.Level).ToListAsync(ct);
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
            // The amount only for an approver who may see it on that voucher, with their rights in the voucher's unit.
            var showAmount = step.Amount is decimal && (!IsVoucherFunction(step.MenuId0)
                || (await permissions.GetRightsInUnitAsync(approverId, step.UnitCode, ct))
                    .Contains(SpecialRightCatalog.Key(step.MenuId0, AmountRight(step.MenuId0))));
            await notifications.PublishAsync(fromUserId, new PublishNotificationRequest(
                Messages.Format(lang, "approval.notify.pendingTitle", step.DocumentTitle ?? step.DocumentId),
                Messages.Format(lang, "approval.notify.pendingBody", FunctionCatalog.Name(step.MenuId0, lang), step.DocumentId, step.Level)
                + (showAmount ? Messages.Format(lang, "approval.notify.amount", step.Amount!.Value.ToString("N0")) : string.Empty),
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
        "inv" => "inventory", "pur" => "purchasing", "sales" => "sales", "fin" => "finance", "hr" => "hr", _ => null
    };
}
