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
/// Phiếu nhập điều chuyển kho (PNDC, function inv_transfer_receipt). The three transfer vouchers share this structure (see docs/kho/dieu-chuyen-kho.md); keep them in step.
/// same layout, statuses, approval and "save at a status" flow as the goods issue.
/// A receipt posts stock IN to the destination warehouse at the value of the issue it follows, so the goods keep their cost.
/// </summary>
public sealed class TransferReceiptService(CoreContext db, IUnitOfWork unitOfWork, IStockLedger ledger,
    IVoucherNumberService numbers, IFiscalPeriodService fiscal, IPermissionService permissions,
    IDocumentApprovalService approvals, IAuditLog audit, IVoucherStatusService statuses, IExcelExporter excel) : ITransferReceiptService
{
    private const string Function = "inv_transfer_receipt";

    public async Task<TransferOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct) => new(
        await db.UsableBy(unitCode).AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new TransferOption(x.Code, x.Name)).ToListAsync(ct));

    private static readonly SortMap<TransferReceipt> SortColumns = SortMap<TransferReceipt>.By(x => x.Id, "date", defaultDescending: true)
        .Add("date", x => x.DocumentDate).Add("code", x => x.Code).Add("warehouse", x => x.FromWarehouseCode)
        .Add("toWarehouse", x => x.ToWarehouseCode).Add("voucherType", x => x.Reason).Add("status", x => x.Status)
        .Add("totalValue", x => x.TotalValue).AddRecordStamps();

    /// <summary>The vouchers of the unit the user may see that the query's filters leave (the warehouse filter matches either warehouse).</summary>
    private async Task<IQueryable<TransferReceipt>> FilterAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var rows = db.TransferReceipts.AsNoTracking().Where(x => x.UnitCode == unitCode);
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
        var lines = await db.TransferReceiptLines.AsNoTracking().Where(x => ids.Contains(x.ReceiptId)).ToListAsync(ct);
        foreach (var row in page.Items) row.Lines = lines.Where(x => x.ReceiptId == row.Id).ToList();
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
        var names = (await statuses.GetNamesAsync(unitCode, ct)).GetValueOrDefault("PNDC");
        string StatusName(string status) => names?.GetValueOrDefault(status)?.Name ?? status;
        var columns = new List<ExportColumn<TransferReceipt>>
        {
            new("export.transferReceipt.code", x => x.Code), new("export.transferReceipt.date", x => x.DocumentDate),
            new("export.transferReceipt.unit", x => units.GetValueOrDefault(x.UnitCode, x.UnitCode)),
            new("export.transferReceipt.fromWarehouse", x => warehouses.GetValueOrDefault(x.FromWarehouseCode, x.FromWarehouseCode)),
            new("export.transferReceipt.toWarehouse", x => warehouses.GetValueOrDefault(x.ToWarehouseCode, x.ToWarehouseCode)),
            new("export.transferReceipt.reason", x => x.Reason), new("export.transferReceipt.person", x => x.PersonName),
            new("export.transferReceipt.status", x => StatusName(x.Status))
        };
        if (canSeeValue) columns.Add(new("export.transferReceipt.totalValue", x => x.TotalValue));
        var content = excel.Write("export.transferReceipt.sheet", columns, list);
        // RecordAsync only adds the row to the context: it is written by this SaveChanges.
        await audit.RecordAsync(new AuditEntry(Function, "transferReceipt", "export", null, AuditActions.Export, [],
            $"{total} rows; search={query.Search}; status={query.Status}; warehouse={query.Warehouse}; type={query.VoucherType}; code={query.Code}; from={query.From}; to={query.To}"), ct);
        await db.SaveChangesAsync(ct);
        return new ExportFile(content, $"PhieuNhapDieuChuyenKho_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    public async Task<TransferDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        await EnsureActionAsync(userId, row, DocumentAction.View, ct);
        return (await ToDtosAsync([row], await CanSeeValueAsync(userId, ct), ct))[0];
    }

    public async Task<TransferDto> CreateAsync(int userId, string unitCode, SaveTransferRequest request, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, Core.Domain.Modules.Users.PermissionAction.Create, ct);
        var check = await ValidateAsync(unitCode, request, null, ct);
        var target = Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, unitCode, isOwner: true, target, ct);
        var id = await unitOfWork.ExecuteAsync(async token =>
        {
            var row = new TransferReceipt
            {
                UnitCode = unitCode, DocumentDate = request.Date, CreatedDate = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            Apply(row, request, check);
            row.Code = await numbers.NextAsync("PNDC", unitCode, request.Date, token);
            db.TransferReceipts.Add(row);
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
        }
        else
        {
            await EnsureActionAsync(userId, row, DocumentAction.Edit, ct);
            if (row.Status != "Draft") throw new BusinessRuleException("transferReceipt.editDraftOnly");
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
            db.TransferReceiptLines.RemoveRange(row.Lines);
            row.Lines.Clear();
            audit.Attach(row, [new AuditChange("items", before, LineSummary(Lines(request, id, check)))]);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, id, check));
            if (posted)
            {
                // Reverse the old posting and post the changed voucher; the stock is checked on the end result only.
                await ledger.ReplaceAsync(userId, await ToPostingAsync(row, unitCode, token), token);
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
            "cancel" => DocumentAction.Cancel, "reopen" => DocumentAction.Reopen, _ => throw new BusinessRuleException("transferReceipt.invalidAction")
        };
        if (normalized == "cancel" && row.Status == "Pending")
            throw new BusinessRuleException("transferReceipt.withdrawBeforeCancel");
        await EnsureActionAsync(userId, row, policyAction, ct);
        if (normalized == "reopen") await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
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
            }
            else if (normalized == "unpost")
            {
                await ledger.UnpostAsync(userId, Function, row.Id, token);
                row.Status = "Approved";
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
    private async Task AdvanceAsync(TransferReceipt row, string unitCode, int userId, DocumentStatus target, CancellationToken token)
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
            await db.SaveChangesAsync(token);
        }
    }

    /// <summary>
    /// The ledger posting: the lines go
    /// IN to the destination warehouse with the value they had when they left (the value of the issue lines, base currency).
    /// The lot number and position only go to the ledger for materials that track lots / locations; a tracked material without them is refused.
    /// </summary>
    private async Task<StockPosting> ToPostingAsync(TransferReceipt row, string unitCode, CancellationToken ct)
    {
        var codes = row.Lines.Select(x => x.MaterialCode).Distinct().ToList();
        var flags = await db.Materials.AsNoTracking().Where(x => codes.Contains(x.Code))
            .ToDictionaryAsync(x => x.Code, x => (x.TrackLot, x.TrackLocation), ct);
        string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        var lines = row.Lines.OrderBy(x => x.LineNo).Select(x =>
        {
            var tracked = flags.GetValueOrDefault(x.MaterialCode);
            return new StockLineInput(x.Id, x.MaterialCode, x.Quantity, x.UomCode, x.Amount,
                tracked.TrackLot ? Text(x.LotNumber) : null, null, null, tracked.TrackLocation ? Text(x.Position) : null);
        }).ToList();
        return new StockPosting(Function, row.Id, unitCode, row.ToWarehouseCode, row.DocumentDate, StockDirection.In, lines);
    }

    /// <summary>
    /// Reopening a cancelled voucher: the lines that follow a line of another voucher must still fit what is left of it (the others
    /// may have taken it while this one was cancelled), and that voucher must still be Posted.
    /// </summary>
    private async Task EnsureLinksStillFitAsync(TransferReceipt row, CancellationToken ct)
    {
        var lines = row.Lines.Where(l => l.TransferIssueLineId != null).ToList();
        if (lines.Count == 0) return;
        var ids = lines.Select(l => l.TransferIssueLineId!.Value).Distinct().ToList();
        var sources = await (from l in db.TransferIssueLines.AsNoTracking() join o in db.TransferIssues.AsNoTracking() on l.IssueId equals o.Id
                             where ids.Contains(l.Id) select new { l.Id, l.Quantity, o.Code, o.Status }).ToListAsync(ct);
        var done = await TransferProgress.ReceivedByIssueLineAsync(db, ids, row.Id, ct);
        foreach (var src in sources)
        {
            if (src.Status != "Posted") throw new BusinessRuleException("reopen.sourceNotReady", src.Code);
            var taken = lines.Where(l => l.TransferIssueLineId == src.Id).Sum(l => l.Quantity);
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
        }
        else
        {
            await EnsureActionAsync(userId, row, DocumentAction.Cancel, ct);
            if (row.Status != "Draft") throw new BusinessRuleException("transferReceipt.deleteDraftOnly");
        }
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            if (posted) await ledger.UnpostAsync(userId, Function, row.Id, token);
            db.TransferReceiptLines.RemoveRange(row.Lines);
            db.TransferReceipts.Remove(row);
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

    private async Task<TransferReceipt> FindAsync(long id, string unitCode, CancellationToken ct, bool tracking = false)
    {
        var query = db.TransferReceipts.Include(x => x.Lines).Where(x => x.Id == id && x.UnitCode == unitCode);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct) ?? throw new NotFoundException("transferReceipt.notFound");
    }

    private async Task<TransferDto> ResultAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        return (await ToDtosAsync([row], await CanSeeValueAsync(userId, ct), ct))[0];
    }

    private async Task EnsureActionAsync(int userId, TransferReceipt row, DocumentAction action, CancellationToken ct)
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
        if (from == to) throw new BusinessRuleException("transferReceipt.sameWarehouse");
        foreach (var code in new[] { from, to })
        {
            if (!await db.Warehouses.AnyAsync(x => x.Code == code && x.IsActive, ct)) throw new BusinessRuleException("transferReceipt.warehouseInvalid", code);
            // The warehouse must be one the unit of the voucher may use (shared warehouses suit every unit).
            if (!await db.UsableBy(unitCode).AnyAsync(x => x.Code == code, ct)) throw new BusinessRuleException("transferReceipt.warehouseNotForUnit", code, unitCode);
        }
        if (request.Items is null || request.Items.Count == 0) throw new BusinessRuleException("transferReceipt.itemsRequired");
        if (request.Items.Count > 500) throw new BusinessRuleException("transferReceipt.tooManyLines");
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
            if (item.Quantity <= 0) throw new BusinessRuleException("transferReceipt.lineInvalid");
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
                && !await db.StorageLocations.AnyAsync(x => x.Code == position && x.WarehouseCode == to, ct))
                throw new BusinessRuleException("voucherLine.locationInvalid", position, to);
        }
        var (sources, codes) = await ValidateSourceAsync(unitCode, from, to, request, selfId, ct);
        return new Checked(materials.ToDictionary(x => x.Key, x => x.Value.Name), codes, sources);
    }

    /// <summary>
    /// A receipt always follows posted transfer issues: each issue must be posted, of this unit and between the same two warehouses;
    /// every line names a line of an issue with the same material and unit; and the quantities received of an issue line (by this
    /// receipt and by the others that are not cancelled) never pass what was issued.
    /// </summary>
    private async Task<(Dictionary<long, SourceInfo>, string?)> ValidateSourceAsync(string unitCode, string from, string to,
        SaveTransferRequest request, long? selfId, CancellationToken ct)
    {
        var lineIds = request.Items.Where(x => x.SourceLineId is not null).Select(x => x.SourceLineId!.Value).Distinct().ToList();
        if (lineIds.Count == 0 || request.Items.Any(x => x.SourceLineId is null)) throw new BusinessRuleException("transferReceipt.sourceRequired");
        var issues = await db.TransferIssues.AsNoTracking().Include(x => x.Lines)
            .Where(x => x.UnitCode == unitCode && x.Lines.Any(l => lineIds.Contains(l.Id))).ToListAsync(ct);
        var owner = new Dictionary<long, SourceInfo>();
        foreach (var i in issues)
        {
            if (i.Status != "Posted") throw new BusinessRuleException("transferReceipt.issueNotPosted", i.Code);
            if (i.FromWarehouseCode != from || i.ToWarehouseCode != to)
                throw new BusinessRuleException("transferReceipt.issueWarehouses", i.Code, i.FromWarehouseCode, i.ToWarehouseCode);
            foreach (var l in i.Lines) owner[l.Id] = new SourceInfo(i.Code, l.MaterialCode, l.UomCode, l.Quantity, l.Amount, l.LotNumber);
        }
        var done = await TransferProgress.ReceivedByIssueLineAsync(db, owner.Keys.ToList(), selfId, ct);
        CheckLines(request, owner, done);
        return (owner, string.Join(",", issues.Select(x => x.Code).Order(StringComparer.Ordinal)));
    }

    /// <summary>Every line follows a source line with the same material and unit, and takes no more than what is left of it.</summary>
    private static void CheckLines(SaveTransferRequest request, Dictionary<long, SourceInfo> owner, Dictionary<long, decimal> done)
    {
        var taken = new Dictionary<long, decimal>();
        foreach (var item in request.Items)
        {
            var material = item.MaterialCode.Trim().ToUpperInvariant();
            if (item.SourceLineId is not long lineId || !owner.TryGetValue(lineId, out var src))
                throw new BusinessRuleException("transferReceipt.lineNotInSource", material);
            if (src.Material != material || src.Uom != item.UomCode.Trim().ToUpperInvariant())
                throw new BusinessRuleException("transferReceipt.sourceLineMismatch", material, src.Code);
            taken[lineId] = taken.GetValueOrDefault(lineId) + item.Quantity;
            var remaining = src.Quantity - done.GetValueOrDefault(lineId);
            if (taken[lineId] > remaining) throw new BusinessRuleException("transferReceipt.exceedsSource", material, remaining.ToString("0.####"), src.Code);
        }
    }

    /// <summary>The value of a receipt line: its share of the value of the issue line it receives.</summary>
    private static decimal AmountOf(SaveTransferLine item, Checked check)
    {
        var src = check.Sources[item.SourceLineId!.Value];
        return src.Quantity == 0 ? 0 : decimal.Round(src.Amount * item.Quantity / src.Quantity, 2);
    }

    private static void Apply(TransferReceipt row, SaveTransferRequest request, Checked check)
    {
        row.DocumentDate = request.Date;
        row.FromWarehouseCode = request.FromWarehouseCode.Trim().ToUpperInvariant();
        row.ToWarehouseCode = request.ToWarehouseCode.Trim().ToUpperInvariant();
        row.Reason = request.Reason.Trim();
        row.PersonName = request.PersonName?.Trim();
        row.TransferIssueCode = check.SourceCodes;
        row.Note = request.Note?.Trim();
        row.TotalValue = decimal.Round(request.Items.Sum(x => AmountOf(x, check)), 2);
    }

    private static List<TransferReceiptLine> Lines(SaveTransferRequest request, long id, Checked check)
    {
        var lines = new List<TransferReceiptLine>();
        var number = 0;
        foreach (var item in request.Items)
        {
            var material = item.MaterialCode.Trim().ToUpperInvariant();
            var amount = AmountOf(item, check);
            var src = check.Sources[item.SourceLineId!.Value];
            lines.Add(new TransferReceiptLine
            {
                ReceiptId = id, LineNo = ++number, MaterialCode = material,
                MaterialName = check.Names.GetValueOrDefault(material, string.Empty),
                UomCode = item.UomCode.Trim().ToUpperInvariant(), Quantity = item.Quantity, Note = item.Note?.Trim(),
                UnitPrice = item.Quantity == 0 ? 0 : decimal.Round(amount / item.Quantity, 4), Amount = amount,
                LotNumber = src.Lot, Position = item.Position?.Trim(), TransferIssueLineId = item.SourceLineId
            });
        }
        return lines;
    }

    private static string LineSummary(IEnumerable<TransferReceiptLine> lines) =>
        string.Join("; ", lines.OrderBy(x => x.LineNo).Select(x => $"{x.MaterialCode} {x.Quantity} {x.UomCode}"));

    private async Task<IReadOnlyList<TransferDto>> ToDtosAsync(List<TransferReceipt> rows, bool canSeeValue, CancellationToken ct)
    {
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var ids = rows.SelectMany(x => new int?[] { x.CreatedBy, x.ApprovedByUserId }).Where(x => x.HasValue)
            .Select(x => x!.Value).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        var lineIds = rows.SelectMany(x => x.Lines).Select(l => l.Id).ToList();
        var done = new Dictionary<long, decimal>();
        // The number of the issue each line receives, shown on the line.
        var sourceIds = rows.SelectMany(x => x.Lines).Where(l => l.TransferIssueLineId != null).Select(l => l.TransferIssueLineId!.Value).Distinct().ToList();
        var sourceCodes = sourceIds.Count == 0 ? new Dictionary<long, string>()
            : await (from sl in db.TransferIssueLines.AsNoTracking() join s in db.TransferIssues.AsNoTracking() on sl.IssueId equals s.Id
                     where sourceIds.Contains(sl.Id) select new { sl.Id, s.Code }).ToDictionaryAsync(x => x.Id, x => x.Code, ct);
        return rows.Select(row =>
        {
            TransferLineDto Line(TransferReceiptLine line) => new(line.Id, line.MaterialCode, line.MaterialName, line.UomCode, line.Quantity,
                canSeeValue ? line.UnitPrice : 0, canSeeValue ? line.Amount : 0, line.LotNumber, line.Position, line.Note,
                done.GetValueOrDefault(line.Id), line.TransferIssueLineId, line.TransferIssueLineId is long sourceLineId ? sourceCodes.GetValueOrDefault(sourceLineId) : null);
            return new TransferDto(row.Id, row.Code, row.DocumentDate, row.CreatedDate, null,
                row.UnitCode, units.GetValueOrDefault(row.UnitCode, row.UnitCode),
                row.FromWarehouseCode, warehouses.GetValueOrDefault(row.FromWarehouseCode, row.FromWarehouseCode),
                row.ToWarehouseCode, warehouses.GetValueOrDefault(row.ToWarehouseCode, row.ToWarehouseCode),
                row.Reason, row.PersonName, row.TransferIssueCode, row.Note, row.Status, canSeeValue ? row.TotalValue : 0,
                users.GetValueOrDefault(row.CreatedBy ?? 0, ""),
                row.ApprovedByUserId is int approved ? users.GetValueOrDefault(approved) : null,
                row.Lines.OrderBy(x => x.LineNo).Select(Line).ToList(), row.Version);
        }).ToList();
    }
}
