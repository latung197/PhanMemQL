using Core.Application.Common.Auditing;
using Core.Application.Common.Export;
using Core.Application.Common.Paging;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Fiscal;
using Core.Application.Modules.Inventory.Documents.Transfers;
using Core.Application.Modules.Inventory.Stock;
using Core.Application.Modules.Users;
using Core.Application.Modules.VoucherStatuses;
using Core.Application.Modules.VoucherNumbering;
using Core.Domain.Modules.Inventory.Documents.Transfers;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory.Documents.Transfers;

/// <summary>
/// Phiếu xuất điều chuyển kho (PXDC, function inv_transfer_issue). The three transfer vouchers share this structure (see docs/kho/dieu-chuyen-kho.md); keep them in step.
/// same layout, statuses, approval and "save at a status" flow as the goods issue.
/// An issue posts stock OUT of the source warehouse (valued at its moving average by the ledger; the value is written back to the lines).
/// </summary>
public sealed class TransferIssueService(CoreContext db, IUnitOfWork unitOfWork, IStockLedger ledger,
    IVoucherNumberService numbers, IFiscalPeriodService fiscal, IPermissionService permissions,
    IDocumentApprovalService approvals, IAuditLog audit, IVoucherStatusService statuses, IExcelExporter excel) : ITransferIssueService
{
    private const string Function = "inv_transfer_issue";

    public async Task<TransferOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct) => new(
        await db.UsableBy(unitCode).AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new TransferOption(x.Code, x.Name)).ToListAsync(ct));

    private static readonly SortMap<TransferIssue> SortColumns = SortMap<TransferIssue>.By(x => x.Id, "date", defaultDescending: true)
        .Add("date", x => x.DocumentDate).Add("code", x => x.Code).Add("warehouse", x => x.FromWarehouseCode)
        .Add("toWarehouse", x => x.ToWarehouseCode).Add("voucherType", x => x.Reason).Add("status", x => x.Status)
        .Add("totalValue", x => x.TotalValue).AddRecordStamps();

    /// <summary>The vouchers of the unit the user may see that the query's filters leave (the warehouse filter matches either warehouse).</summary>
    private async Task<IQueryable<TransferIssue>> FilterAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var rows = db.TransferIssues.AsNoTracking().Where(x => x.UnitCode == unitCode);
        if (!await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewAll, ct)) rows = rows.Where(x => x.CreatedBy == userId);
        if (query.StatusFilter is { } status) { var text = status.ToString(); rows = rows.Where(x => x.Status == text); }
        if (!string.IsNullOrWhiteSpace(query.Warehouse)) { var wh = query.Warehouse.Trim().ToUpperInvariant(); rows = rows.Where(x => x.FromWarehouseCode == wh || x.ToWarehouseCode == wh); }
        if (!string.IsNullOrWhiteSpace(query.VoucherType)) { var type = query.VoucherType.Trim(); rows = rows.Where(x => x.Reason == type); }
        if (query.From is { } from) rows = rows.Where(x => x.DocumentDate >= from);
        if (query.To is { } to) rows = rows.Where(x => x.DocumentDate <= to);
        var codes = query.CodeParts;
        if (codes.Count == 1) { var pattern = PagingExtensions.ContainsPattern(codes[0]); rows = rows.Where(x => SearchFunctions.Matches(x.Code, pattern)); }
        else if (codes.Count > 1) rows = rows.Where(x => codes.Contains(x.Code));
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = PagingExtensions.ContainsPattern(query.Search);
            rows = rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Note, pattern)
                || SearchFunctions.Matches(x.PersonName, pattern) || SearchFunctions.Matches(x.Reason, pattern)
                || SearchFunctions.Matches(x.FromWarehouseCode, pattern) || SearchFunctions.Matches(x.ToWarehouseCode, pattern)
                || db.Warehouses.Any(w => (w.Code == x.FromWarehouseCode || w.Code == x.ToWarehouseCode) && SearchFunctions.Matches(w.Name, pattern))
                || x.Lines.Any(l => SearchFunctions.Matches(l.MaterialCode, pattern) || SearchFunctions.Matches(l.MaterialName, pattern)));
        }
        return rows;
    }

    /// <summary>Whether the user may see the value of the goods (the right VIEW_COST of this function); an order has no value.</summary>
    private async Task<bool> CanSeeValueAsync(int userId, CancellationToken ct) =>
        await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewCost, ct);

    /// <summary>A value column cannot be sorted by someone who may not see values (the order would give them away).</summary>
    private static void EnsureSortAllowed(VoucherListQuery query, bool canSeeValue)
    {
        if (!canSeeValue && string.Equals(query.Sort, "totalValue", StringComparison.OrdinalIgnoreCase))
            throw new BusinessRuleException("paging.sortInvalid");
    }

    public async Task<PagedResult<TransferDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var canSeeValue = await CanSeeValueAsync(userId, ct);
        EnsureSortAllowed(query, canSeeValue);
        var rows = await FilterAsync(userId, unitCode, query, ct);
        // The page is cut on the headers; the lines of those few vouchers are read afterwards.
        var page = await rows.ToPagedAsync(query, SortColumns, ct);
        var ids = page.Items.Select(x => x.Id).ToList();
        var lines = await db.TransferIssueLines.AsNoTracking().Where(x => ids.Contains(x.IssueId)).ToListAsync(ct);
        foreach (var row in page.Items) row.Lines = lines.Where(x => x.IssueId == row.Id).ToList();
        return new PagedResult<TransferDto>(await ToDtosAsync(page.Items.ToList(), canSeeValue, ct), page.Total, page.Page, page.PageSize);
    }

    public async Task<ExportFile> ExportAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, Core.Domain.Modules.Users.PermissionAction.Export, ct);
        var canSeeValue = await CanSeeValueAsync(userId, ct);
        EnsureSortAllowed(query, canSeeValue);
        var rows = await FilterAsync(userId, unitCode, query, ct);
        var total = await rows.CountAsync(ct);
        if (total > PagingLimits.MaxExportRows) throw new BusinessRuleException("export.tooMany", PagingLimits.MaxExportRows);
        var list = await SortColumns.Apply(rows, query.Sort, query.Dir).ToListAsync(ct);
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var names = (await statuses.GetNamesAsync(unitCode, ct)).GetValueOrDefault("PXDC");
        string StatusName(string status) => names?.GetValueOrDefault(status)?.Name ?? status;
        var columns = new List<ExportColumn<TransferIssue>>
        {
            new("export.transferIssue.code", x => x.Code), new("export.transferIssue.date", x => x.DocumentDate),
            new("export.transferIssue.unit", x => units.GetValueOrDefault(x.UnitCode, x.UnitCode)),
            new("export.transferIssue.fromWarehouse", x => warehouses.GetValueOrDefault(x.FromWarehouseCode, x.FromWarehouseCode)),
            new("export.transferIssue.toWarehouse", x => warehouses.GetValueOrDefault(x.ToWarehouseCode, x.ToWarehouseCode)),
            new("export.transferIssue.reason", x => x.Reason), new("export.transferIssue.person", x => x.PersonName),
            new("export.transferIssue.status", x => StatusName(x.Status))
        };
        if (canSeeValue) columns.Add(new("export.transferIssue.totalValue", x => x.TotalValue));
        var content = excel.Write("export.transferIssue.sheet", columns, list);
        // RecordAsync only adds the row to the context: it is written by this SaveChanges.
        await audit.RecordAsync(new AuditEntry(Function, "transferIssue", "export", null, AuditActions.Export, [],
            $"{total} rows; search={query.Search}; status={query.Status}; warehouse={query.Warehouse}; type={query.VoucherType}; code={query.Code}; from={query.From}; to={query.To}"), ct);
        await db.SaveChangesAsync(ct);
        return new ExportFile(content, $"PhieuXuatDieuChuyenKho_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    public async Task<TransferDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        await EnsureActionAsync(userId, row, DocumentAction.View, ct);
        return (await ToDtosAsync([row], await CanSeeValueAsync(userId, ct), ct))[0];
    }

    /// <summary>Posted issues with something left to receive (see <see cref="ITransferIssueService.GetOpenAsync"/>); values need VIEW_COST of the receipt screen.</summary>
    public async Task<IReadOnlyList<OpenTransferDto>> GetOpenAsync(int userId, string unitCode, long? exceptReceiptId, CancellationToken ct)
    {
        var canSeeValue = await permissions.HasRightAsync(userId, "inv_transfer_receipt", SpecialRightCatalog.ViewCost, ct);
        var rows = await db.TransferIssues.AsNoTracking().Include(x => x.Lines)
            .Where(x => x.UnitCode == unitCode && x.Status == "Posted")
            .OrderByDescending(x => x.DocumentDate).ThenByDescending(x => x.Id).ToListAsync(ct);
        var done = await TransferProgress.ReceivedByIssueLineAsync(db, rows.SelectMany(x => x.Lines).Select(x => x.Id).ToList(), exceptReceiptId, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var result = new List<OpenTransferDto>();
        foreach (var row in rows)
        {
            var lines = row.Lines.OrderBy(x => x.LineNo).Select(x =>
            {
                var received = done.GetValueOrDefault(x.Id);
                return new OpenTransferLineDto(x.Id, x.MaterialCode, x.MaterialName, x.UomCode, x.Quantity, received, x.Quantity - received,
                    canSeeValue ? x.UnitPrice : 0, x.LotNumber, null, x.Note);
            }).Where(x => x.RemainingQuantity > 0).ToList();
            if (lines.Count == 0) continue;
            result.Add(new OpenTransferDto(row.Id, row.Code, row.DocumentDate, null, row.FromWarehouseCode,
                warehouses.GetValueOrDefault(row.FromWarehouseCode, row.FromWarehouseCode), row.ToWarehouseCode,
                warehouses.GetValueOrDefault(row.ToWarehouseCode, row.ToWarehouseCode), row.Reason, row.PersonName, row.Note, lines));
        }
        return result;
    }

    public async Task<TransferDto> CreateAsync(int userId, string unitCode, SaveTransferRequest request, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, Core.Domain.Modules.Users.PermissionAction.Create, ct);
        var check = await ValidateAsync(unitCode, request, null, ct);
        var target = Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, unitCode, isOwner: true, target, ct);
        var id = await unitOfWork.ExecuteAsync(async token =>
        {
            var row = new TransferIssue
            {
                UnitCode = unitCode, DocumentDate = request.Date, CreatedDate = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            Apply(row, request, check);
            row.Code = await numbers.NextAsync("PXDC", unitCode, request.Date, token);
            db.TransferIssues.Add(row);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, row.Id, check));
            audit.Attach(row, [new AuditChange("items", null, LineSummary(row.Lines))]);
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
            return row.Id;
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<TransferDto> UpdateAsync(int userId, string unitCode, long id, SaveTransferRequest request, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        // A posted voucher may be changed or deleted with the right ST_EDIT_POSTED: reverse the posting, change, post again (all or nothing).
        var posted = row.Status == "Posted";
        if (posted)
        {
            await EnsureActionAsync(userId, row, DocumentAction.View, ct);
            await PostedEdit.EnsureAsync(permissions, userId, Function, row.UnitCode, forDelete: false, ct);
            if (await TransferProgress.HasReceiptsAsync(db, row.Id, ct)) throw new BusinessRuleException("transferIssue.editHasReceipts");
        }
        else
        {
            await EnsureActionAsync(userId, row, DocumentAction.Edit, ct);
            if (row.Status != "Draft") throw new BusinessRuleException("transferIssue.editDraftOnly");
        }
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        var check = await ValidateAsync(unitCode, request, id, ct);
        var target = posted ? DocumentStatus.Posted : Parse(request.TargetStatus);
        if (!posted) await EnsureTargetAllowedAsync(userId, unitCode, row.CreatedBy == userId, target, ct);
        db.ExpectVersion(row, request.Version, touch: true);
        var before = LineSummary(row.Lines);
        await unitOfWork.ExecuteAsync(async token =>
        {
            Apply(row, request, check);
            db.TransferIssueLines.RemoveRange(row.Lines);
            row.Lines.Clear();
            audit.Attach(row, [new AuditChange("items", before, LineSummary(Lines(request, id, check)))]);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, id, check));
            if (posted)
            {
                // Reverse the old posting and post the changed voucher; the stock is checked on the end result only.
                await ledger.ReplaceAsync(userId, await ToPostingAsync(row, unitCode, token), token);
                await PriceFromLedgerAsync(row, token);
                await db.SaveChangesAsync(token);
            }
            else await AdvanceAsync(row, unitCode, userId, target, token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<TransferDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct)
    {
        await Core.Application.Common.Permissions.PermissionGate.EnsureTouchAsync(permissions, userId, Function, ct);
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        var normalized = action.ToLowerInvariant();
        if (normalized == "withdraw")
        {
            if (row.Status != "Pending") throw new BusinessRuleException("policy.notPending");
            if (row.CreatedBy != userId) throw new ForbiddenException("approval.withdrawOwnOnly");
            await EnsureActionAsync(userId, row, DocumentAction.View, ct);
            await unitOfWork.ExecuteAsync(async token =>
            {
                await approvals.WithdrawAsync(userId, unitCode, Function, row.Code, token);
                row.Status = "Draft";
                await db.SaveChangesAsync(token);
            }, ct);
            return await ResultAsync(userId, unitCode, id, ct);
        }
        var policyAction = normalized switch
        {
            "submit" => DocumentAction.Submit, "approve" => DocumentAction.Approve,
            "post" => DocumentAction.Post, "unpost" => DocumentAction.Unpost,
            "cancel" => DocumentAction.Cancel, "reopen" => DocumentAction.Reopen, _ => throw new BusinessRuleException("transferIssue.invalidAction")
        };
        if (normalized == "cancel" && row.Status == "Pending")
            throw new BusinessRuleException("transferIssue.withdrawBeforeCancel");
        await EnsureActionAsync(userId, row, policyAction, ct);
        if (normalized == "reopen") await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        if (normalized == "unpost" && await TransferProgress.HasReceiptsAsync(db, row.Id, ct))
            throw new BusinessRuleException("transferIssue.unpostHasReceipts");
        if (normalized is "post" or "unpost") await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            if (normalized == "submit")
            {
                await approvals.SubmitAsync(userId, unitCode,
                    new SubmitDocumentRequest(Function, row.Code, row.Code, row.TotalValue), token);
                row.Status = "Pending";
            }
            else if (normalized == "approve")
            {
                var result = await approvals.ApproveAsync(userId, unitCode, Function, row.Code,
                    new ApprovalActionRequest(null), token);
                if (result.Status == "APPROVED")
                {
                    row.Status = "Approved";
                    row.ApprovedByUserId = userId;
                }
            }
            else if (normalized == "post")
            {
                await ledger.PostAsync(userId, await ToPostingAsync(row, unitCode, token), token);
                row.Status = "Posted";
                await PriceFromLedgerAsync(row, token);
            }
            else if (normalized == "unpost")
            {
                await ledger.UnpostAsync(userId, Function, row.Id, token);
                row.Status = "Approved";
                ClearPrices(row);
            }
            else if (normalized == "reopen")
            {
                // A cancelled voucher comes back as a draft: what it follows must still have room for it.
                await EnsureLinksStillFitAsync(row, token);
                row.Status = "Draft";
                row.ApprovedByUserId = null;
            }
            else row.Status = "Cancelled";
            await db.SaveChangesAsync(token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    /// <summary>The status to save at.</summary>
    private static DocumentStatus Parse(string? value)
    {
        var target = VoucherTargetStatus.Parse(value);
        return target;
    }

    /// <summary>
    /// Saving straight at a later status needs the user's status right for it in this company unit (rights are granted up to a status,
    /// so a later right includes the earlier steps) and the status in use there. Checked before anything is saved.
    /// </summary>
    private async Task EnsureTargetAllowedAsync(int userId, string unitCode, bool isOwner, DocumentStatus target, CancellationToken ct)
    {
        if (target == DocumentStatus.Draft) return;
        var actor = DocumentActor.For(await permissions.GetEffectiveAsync(userId, ct), await permissions.GetRightsAsync(userId, ct), Function, isOwner, unitCode);
        var decision = DocumentStatusPolicy.CheckTarget(target, actor);
        if (!decision.Allowed) throw new ForbiddenException(decision.Reason ?? "permission.denied");
        if (target == DocumentStatus.Posted)
        {
            var post = DocumentStatusPolicy.Check(DocumentAction.Post, DocumentStatus.Approved, actor);
            if (!post.Allowed) throw new ForbiddenException(post.Reason ?? "permission.denied");
        }
        // The step that is switched off is skipped, not refused: only saving at it (Pending) needs it in use.
        if (target == DocumentStatus.Pending) await statuses.EnsureEnabledAsync(unitCode, Function, DocumentStatus.Pending, ct);
    }

    /// <summary>Takes the just saved draft to the status the user asked for, in the same transaction (see GoodsIssueService.AdvanceAsync).</summary>
    private async Task AdvanceAsync(TransferIssue row, string unitCode, int userId, DocumentStatus target, CancellationToken token)
    {
        if (target == DocumentStatus.Draft) return;
        if (target == DocumentStatus.Pending)
        {
            await approvals.SubmitAsync(userId, unitCode, new SubmitDocumentRequest(Function, row.Code, row.Code, row.TotalValue), token);
            return;
        }
        if (await statuses.IsEnabledAsync(unitCode, Function, DocumentStatus.Pending, token))
        {
            await approvals.EnsureCanApproveDirectAsync(userId, unitCode, Function, row.TotalValue, token);
            await approvals.ApproveDirectAsync(userId, unitCode, Function, row.Code, row.Code, token);
        }
        else await approvals.ApproveWithoutFlowAsync(userId, unitCode, Function, row.Code, token);
        if (target == DocumentStatus.Posted)
        {
            await ledger.PostAsync(userId, await ToPostingAsync(row, unitCode, token), token);
            row.Status = "Posted";
            await PriceFromLedgerAsync(row, token);
            await db.SaveChangesAsync(token);
        }
    }

    /// <summary>
    /// The ledger posting: the lines go
    /// OUT of the source warehouse; the ledger values them at its moving average, so no price is sent.
    /// The lot number and position only go to the ledger for materials that track lots / locations; a tracked material without them is refused.
    /// </summary>
    private async Task<StockPosting> ToPostingAsync(TransferIssue row, string unitCode, CancellationToken ct)
    {
        var codes = row.Lines.Select(x => x.MaterialCode).Distinct().ToList();
        var flags = await db.Materials.AsNoTracking().Where(x => codes.Contains(x.Code))
            .ToDictionaryAsync(x => x.Code, x => (x.TrackLot, x.TrackLocation), ct);
        string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        var lines = row.Lines.OrderBy(x => x.LineNo).Select(x =>
        {
            var tracked = flags.GetValueOrDefault(x.MaterialCode);
            return new StockLineInput(x.Id, x.MaterialCode, x.Quantity, x.UomCode, 0,
                tracked.TrackLot ? Text(x.LotNumber) : null, null, null, tracked.TrackLocation ? Text(x.Position) : null);
        }).ToList();
        return new StockPosting(Function, row.Id, unitCode, row.FromWarehouseCode, row.DocumentDate, StockDirection.Out, lines);
    }

    /// <summary>After posting: the value the ledger gave each line (the journal rows of the line, negative for stock out) becomes its amount, and the sum the voucher total.</summary>
    private async Task PriceFromLedgerAsync(TransferIssue row, CancellationToken ct)
    {
        var ids = row.Lines.Select(x => x.Id).ToList();
        var moved = await db.StockMovements.AsNoTracking()
            .Where(m => m.SourceFunction == Function && m.SourceId == row.Id && ids.Contains(m.SourceLineId)).ToListAsync(ct);
        var values = moved.GroupBy(m => m.SourceLineId).ToDictionary(g => g.Key, g => -g.Sum(m => m.Value));
        foreach (var line in row.Lines)
        {
            var amount = decimal.Round(values.GetValueOrDefault(line.Id), 2);
            line.Amount = amount;
            line.UnitPrice = line.Quantity == 0 ? 0 : decimal.Round(amount / line.Quantity, 4);
        }
        row.TotalValue = decimal.Round(row.Lines.Sum(x => x.Amount), 2);
    }

    /// <summary>An issue that is no longer posted carries no value.</summary>
    private static void ClearPrices(TransferIssue row)
    {
        foreach (var line in row.Lines) { line.Amount = 0; line.UnitPrice = 0; }
        row.TotalValue = 0;
    }

    /// <summary>
    /// Reopening a cancelled voucher: the lines that follow a line of another voucher must still fit what is left of it (the others
    /// may have taken it while this one was cancelled), and that voucher must still be Approved.
    /// </summary>
    private async Task EnsureLinksStillFitAsync(TransferIssue row, CancellationToken ct)
    {
        var lines = row.Lines.Where(l => l.TransferOrderLineId != null).ToList();
        if (lines.Count == 0) return;
        var ids = lines.Select(l => l.TransferOrderLineId!.Value).Distinct().ToList();
        var sources = await (from l in db.TransferOrderLines.AsNoTracking() join o in db.TransferOrders.AsNoTracking() on l.OrderId equals o.Id
                             where ids.Contains(l.Id) select new { l.Id, l.Quantity, o.Code, o.Status }).ToListAsync(ct);
        var done = await TransferProgress.IssuedByOrderLineAsync(db, ids, row.Id, ct);
        foreach (var src in sources)
        {
            if (src.Status != "Approved") throw new BusinessRuleException("reopen.sourceNotReady", src.Code);
            var taken = lines.Where(l => l.TransferOrderLineId == src.Id).Sum(l => l.Quantity);
            var remaining = src.Quantity - done.GetValueOrDefault(src.Id);
            if (taken > remaining) throw new BusinessRuleException("reopen.exceedsSource", src.Code, remaining.ToString("0.####"));
        }
    }

    public async Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        // A posted voucher may be changed or deleted with the right ST_EDIT_POSTED: reverse the posting, change, post again (all or nothing).
        var posted = row.Status == "Posted";
        if (posted)
        {
            await EnsureActionAsync(userId, row, DocumentAction.View, ct);
            await PostedEdit.EnsureAsync(permissions, userId, Function, row.UnitCode, forDelete: true, ct);
            if (await TransferProgress.HasReceiptsAsync(db, row.Id, ct)) throw new BusinessRuleException("transferIssue.editHasReceipts");
        }
        else
        {
            await EnsureActionAsync(userId, row, DocumentAction.Cancel, ct);
            if (row.Status != "Draft") throw new BusinessRuleException("transferIssue.deleteDraftOnly");
        }
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            if (posted) await ledger.UnpostAsync(userId, Function, row.Id, token);
            db.TransferIssueLines.RemoveRange(row.Lines);
            db.TransferIssues.Remove(row);
            await db.SaveChangesAsync(token);
        }, ct);
    }

    public async Task<TransferDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct)
    {
        await Core.Application.Common.Permissions.PermissionGate.EnsureTouchAsync(permissions, userId, Function, ct);
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Reject, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            await approvals.RejectAsync(userId, unitCode, Function, row.Code,
                new ApprovalActionRequest(reason), token);
            row.Status = "Draft";
            await db.SaveChangesAsync(token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    private async Task<TransferIssue> FindAsync(long id, string unitCode, CancellationToken ct, bool tracking = false)
    {
        var query = db.TransferIssues.Include(x => x.Lines).Where(x => x.Id == id && x.UnitCode == unitCode);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct) ?? throw new NotFoundException("transferIssue.notFound");
    }

    private async Task<TransferDto> ResultAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        return (await ToDtosAsync([row], await CanSeeValueAsync(userId, ct), ct))[0];
    }

    private async Task EnsureActionAsync(int userId, TransferIssue row, DocumentAction action, CancellationToken ct)
    {
        var actor = DocumentActor.For(await permissions.GetEffectiveAsync(userId, ct),
            await permissions.GetRightsAsync(userId, ct), Function, row.CreatedBy == userId, row.UnitCode);
        var decision = DocumentStatusPolicy.Check(action, Enum.Parse<DocumentStatus>(row.Status), actor);
        if (!decision.Allowed) throw new ForbiddenException(decision.Reason ?? "permission.denied");
        if (action == DocumentAction.Submit) await statuses.EnsureEnabledAsync(row.UnitCode, Function, DocumentStatus.Pending, ct);
    }

    /// <summary>A line of the voucher this one follows: its number, material, unit, quantity, value and lot.</summary>
    private sealed record SourceInfo(string Code, string Material, string Uom, decimal Quantity, decimal Amount, string? Lot);

    /// <summary>What a save found out while checking the request: the material names and the vouchers / lines the lines follow.</summary>
    private sealed record Checked(IReadOnlyDictionary<string, string> Names, string? SourceCodes, IReadOnlyDictionary<long, SourceInfo> Sources);

    private async Task<Checked> ValidateAsync(string unitCode, SaveTransferRequest request, long? selfId, CancellationToken ct)
    {
        await fiscal.EnsureDateOpenAsync(unitCode, request.Date, ct);
        var from = Guard.Code(request.FromWarehouseCode, 20, "field.fromWarehouse");
        var to = Guard.Code(request.ToWarehouseCode, 20, "field.toWarehouse");
        if (from == to) throw new BusinessRuleException("transferIssue.sameWarehouse");
        foreach (var code in new[] { from, to })
        {
            if (!await db.Warehouses.AnyAsync(x => x.Code == code && x.IsActive, ct)) throw new BusinessRuleException("transferIssue.warehouseInvalid", code);
            // The warehouse must be one the unit of the voucher may use (shared warehouses suit every unit).
            if (!await db.UsableBy(unitCode).AnyAsync(x => x.Code == code, ct)) throw new BusinessRuleException("transferIssue.warehouseNotForUnit", code, unitCode);
        }
        if (request.Items is null || request.Items.Count == 0) throw new BusinessRuleException("transferIssue.itemsRequired");
        if (request.Items.Count > 500) throw new BusinessRuleException("transferIssue.tooManyLines");
        _ = Guard.Required(request.Reason, 100, "field.transferReason");
        _ = Guard.Optional(request.PersonName, 200, "field.personName");
        _ = Guard.Optional(request.Note, 1000, "field.note");
        foreach (var item in request.Items)
        {
            _ = Guard.Code(item.MaterialCode, 50, "field.materialCode");
            _ = Guard.Code(item.UomCode, 20, "field.uomCode");
            _ = Guard.Optional(item.Note, 300, "field.note");
            _ = Guard.Optional(item.LotNumber, 64, "field.lotNumber");
            _ = Guard.Optional(item.Position, 100, "field.position");
            if (item.Quantity <= 0) throw new BusinessRuleException("transferIssue.lineInvalid");
        }
        // Every line points to a stock material and a unit of the catalogs (the name of the material is taken from the catalog).
        var materialCodes = request.Items.Select(x => x.MaterialCode.Trim().ToUpperInvariant()).Distinct().ToList();
        var materials = await db.Materials.AsNoTracking().Where(x => materialCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, ct);
        var uomCodes = request.Items.Select(x => x.UomCode.Trim().ToUpperInvariant()).Distinct().ToList();
        var activeUoms = (await db.Uoms.AsNoTracking().Where(x => uomCodes.Contains(x.Code) && x.IsActive).Select(x => x.Code).ToListAsync(ct)).ToHashSet();
        foreach (var item in request.Items)
        {
            var code = item.MaterialCode.Trim().ToUpperInvariant();
            if (!materials.TryGetValue(code, out var material) || !material.IsActive)
                throw new BusinessRuleException("voucherLine.materialInvalid", code);
            if (!material.IsStockItem) throw new BusinessRuleException("voucherLine.materialNotStock", code);
            if (!activeUoms.Contains(item.UomCode.Trim().ToUpperInvariant()))
                throw new BusinessRuleException("voucherLine.uomInvalid", item.UomCode.Trim().ToUpperInvariant(), code);
            await UomRules.EnsureUsableAsync(db, material, item.UomCode, ct);
            // A material tracked by location needs a location of the warehouse the stock moves in (the source on an issue, the destination on a receipt).
            var position = item.Position?.Trim().ToUpperInvariant();
            if (material.TrackLocation && !string.IsNullOrEmpty(position)
                && !await db.StorageLocations.AnyAsync(x => x.Code == position && x.WarehouseCode == from, ct))
                throw new BusinessRuleException("voucherLine.locationInvalid", position, from);
        }
        var (sources, codes) = await ValidateSourceAsync(unitCode, from, to, request, selfId, ct);
        return new Checked(materials.ToDictionary(x => x.Key, x => x.Value.Name), codes, sources);
    }

    /// <summary>
    /// An issue that carries out transfer orders: each order must be approved, of this unit and between the same two warehouses; every
    /// line names a line of an order with the same material and unit; and the quantities taken from an order line (by this issue and by the
    /// others that are not cancelled) never pass what was ordered. An issue with no source line at all is a free issue.
    /// </summary>
    private async Task<(Dictionary<long, SourceInfo>, string?)> ValidateSourceAsync(string unitCode, string from, string to,
        SaveTransferRequest request, long? selfId, CancellationToken ct)
    {
        var lineIds = request.Items.Where(x => x.SourceLineId is not null).Select(x => x.SourceLineId!.Value).Distinct().ToList();
        if (lineIds.Count == 0) return ([], null);
        var orders = await db.TransferOrders.AsNoTracking().Include(x => x.Lines)
            .Where(x => x.UnitCode == unitCode && x.Lines.Any(l => lineIds.Contains(l.Id))).ToListAsync(ct);
        var owner = new Dictionary<long, SourceInfo>();
        foreach (var o in orders)
        {
            if (o.Status != "Approved") throw new BusinessRuleException("transferIssue.orderNotApproved", o.Code);
            if (o.FromWarehouseCode != from || o.ToWarehouseCode != to)
                throw new BusinessRuleException("transferIssue.orderWarehouses", o.Code, o.FromWarehouseCode, o.ToWarehouseCode);
            foreach (var l in o.Lines) owner[l.Id] = new SourceInfo(o.Code, l.MaterialCode, l.UomCode, l.Quantity, 0m, null);
        }
        var done = await TransferProgress.IssuedByOrderLineAsync(db, owner.Keys.ToList(), selfId, ct);
        CheckLines(request, owner, done);
        return (owner, string.Join(",", orders.Select(x => x.Code).Order(StringComparer.Ordinal)));
    }

    /// <summary>Every line follows a source line with the same material and unit, and takes no more than what is left of it.</summary>
    private static void CheckLines(SaveTransferRequest request, Dictionary<long, SourceInfo> owner, Dictionary<long, decimal> done)
    {
        var taken = new Dictionary<long, decimal>();
        foreach (var item in request.Items)
        {
            var material = item.MaterialCode.Trim().ToUpperInvariant();
            if (item.SourceLineId is not long lineId || !owner.TryGetValue(lineId, out var src))
                throw new BusinessRuleException("transferIssue.lineNotInSource", material);
            if (src.Material != material || src.Uom != item.UomCode.Trim().ToUpperInvariant())
                throw new BusinessRuleException("transferIssue.sourceLineMismatch", material, src.Code);
            taken[lineId] = taken.GetValueOrDefault(lineId) + item.Quantity;
            var remaining = src.Quantity - done.GetValueOrDefault(lineId);
            if (taken[lineId] > remaining) throw new BusinessRuleException("transferIssue.exceedsSource", material, remaining.ToString("0.####"), src.Code);
        }
    }

    private static void Apply(TransferIssue row, SaveTransferRequest request, Checked check)
    {
        row.DocumentDate = request.Date;
        row.FromWarehouseCode = request.FromWarehouseCode.Trim().ToUpperInvariant();
        row.ToWarehouseCode = request.ToWarehouseCode.Trim().ToUpperInvariant();
        row.Reason = request.Reason.Trim();
        row.PersonName = request.PersonName?.Trim();
        row.TransferOrderCode = check.SourceCodes;
        row.Note = request.Note?.Trim();
    }

    private static List<TransferIssueLine> Lines(SaveTransferRequest request, long id, Checked check)
    {
        var lines = new List<TransferIssueLine>();
        var number = 0;
        foreach (var item in request.Items)
        {
            var material = item.MaterialCode.Trim().ToUpperInvariant();
            lines.Add(new TransferIssueLine
            {
                IssueId = id, LineNo = ++number, MaterialCode = material,
                MaterialName = check.Names.GetValueOrDefault(material, string.Empty),
                UomCode = item.UomCode.Trim().ToUpperInvariant(), Quantity = item.Quantity, Note = item.Note?.Trim(),
                LotNumber = item.LotNumber?.Trim(), Position = item.Position?.Trim(), TransferOrderLineId = item.SourceLineId,
            });
        }
        return lines;
    }

    private static string LineSummary(IEnumerable<TransferIssueLine> lines) =>
        string.Join("; ", lines.OrderBy(x => x.LineNo).Select(x => $"{x.MaterialCode} {x.Quantity} {x.UomCode}"));

    private async Task<IReadOnlyList<TransferDto>> ToDtosAsync(List<TransferIssue> rows, bool canSeeValue, CancellationToken ct)
    {
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var ids = rows.SelectMany(x => new int?[] { x.CreatedBy, x.ApprovedByUserId }).Where(x => x.HasValue)
            .Select(x => x!.Value).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        var lineIds = rows.SelectMany(x => x.Lines).Select(l => l.Id).ToList();
        var done = await TransferProgress.ReceivedByIssueLineAsync(db, lineIds, null, ct);
        // The number of the order each line carries out, shown on the line.
        var sourceIds = rows.SelectMany(x => x.Lines).Where(l => l.TransferOrderLineId != null).Select(l => l.TransferOrderLineId!.Value).Distinct().ToList();
        var sourceCodes = sourceIds.Count == 0 ? new Dictionary<long, string>()
            : await (from sl in db.TransferOrderLines.AsNoTracking() join s in db.TransferOrders.AsNoTracking() on sl.OrderId equals s.Id
                     where sourceIds.Contains(sl.Id) select new { sl.Id, s.Code }).ToDictionaryAsync(x => x.Id, x => x.Code, ct);
        return rows.Select(row =>
        {
            TransferLineDto Line(TransferIssueLine line) => new(line.Id, line.MaterialCode, line.MaterialName, line.UomCode, line.Quantity,
                canSeeValue ? line.UnitPrice : 0, canSeeValue ? line.Amount : 0, line.LotNumber, line.Position, line.Note,
                done.GetValueOrDefault(line.Id), line.TransferOrderLineId, line.TransferOrderLineId is long sourceLineId ? sourceCodes.GetValueOrDefault(sourceLineId) : null);
            return new TransferDto(row.Id, row.Code, row.DocumentDate, row.CreatedDate, null,
                row.UnitCode, units.GetValueOrDefault(row.UnitCode, row.UnitCode),
                row.FromWarehouseCode, warehouses.GetValueOrDefault(row.FromWarehouseCode, row.FromWarehouseCode),
                row.ToWarehouseCode, warehouses.GetValueOrDefault(row.ToWarehouseCode, row.ToWarehouseCode),
                row.Reason, row.PersonName, row.TransferOrderCode, row.Note, row.Status, canSeeValue ? row.TotalValue : 0,
                users.GetValueOrDefault(row.CreatedBy ?? 0, ""),
                row.ApprovedByUserId is int approved ? users.GetValueOrDefault(approved) : null,
                row.Lines.OrderBy(x => x.LineNo).Select(Line).ToList(), row.Version);
        }).ToList();
    }
}
