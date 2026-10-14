using Core.Infrastructure.Modules.Purchasing.Categories;
using Core.Application.Common.Auditing;
using Core.Application.Common.Export;
using Core.Application.Common.Paging;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Currencies;
using Core.Application.Modules.Fiscal;
using Core.Application.Modules.Inventory.Documents.GoodsReceipts;
using Core.Application.Modules.Users;
using Core.Infrastructure.Modules.Purchasing.Documents.PurchaseOrders;
using Core.Application.Modules.VoucherStatuses;
using Core.Application.Modules.VoucherNumbering;
using Core.Domain.Modules.Inventory.Documents.GoodsReceipts;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Core.Application.Modules.Inventory.Stock;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory.Documents.GoodsReceipts;

public sealed class GoodsReceiptService(CoreContext db, IUnitOfWork unitOfWork, IStockLedger ledger,
    IVoucherNumberService numbers, IFiscalPeriodService fiscal, IExchangeRateService rates, IPermissionService permissions,
    IDocumentApprovalService approvals, IAuditLog audit, IVoucherStatusService statuses, IExcelExporter excel) : IGoodsReceiptService
{
    private const string Function = "inv_receipt";

    public async Task<GoodsReceiptOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct) => new(
        await db.UsableBy(unitCode).AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new GoodsReceiptOption(x.Code, x.Name)).ToListAsync(ct),
        await db.Currencies.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new GoodsReceiptOption(x.Code, x.Name)).ToListAsync(ct));

    private static readonly SortMap<GoodsReceipt> SortColumns = SortMap<GoodsReceipt>.By(x => x.Id, "date", defaultDescending: true)
        .Add("date", x => x.DocumentDate).Add("code", x => x.Code).Add("warehouse", x => x.WarehouseCode)
        .Add("voucherType", x => x.VoucherType).Add("supplier", x => x.SupplierName).Add("status", x => x.Status)
        .Add("totalValue", x => x.TotalValue).AddRecordStamps();

    /// <summary>The receipts of the unit the user may see that the query's filters leave.</summary>
    private async Task<IQueryable<GoodsReceipt>> FilterAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var rows = db.GoodsReceipts.AsNoTracking().Where(x => x.UnitCode == unitCode);
        if (!await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewAll, ct)) rows = rows.Where(x => x.CreatedBy == userId);
        if (query.StatusFilter is { } status) { var text = status.ToString(); rows = rows.Where(x => x.Status == text); }
        if (!string.IsNullOrWhiteSpace(query.Warehouse)) { var wh = query.Warehouse.Trim().ToUpperInvariant(); rows = rows.Where(x => x.WarehouseCode == wh); }
        if (!string.IsNullOrWhiteSpace(query.Project)) { var pj = query.Project.Trim().ToUpperInvariant(); rows = rows.Where(x => x.ProjectCode == pj); }
        if (!string.IsNullOrWhiteSpace(query.VoucherType)) { var type = query.VoucherType.Trim(); rows = rows.Where(x => x.VoucherType == type); }
        if (query.From is { } from) rows = rows.Where(x => x.DocumentDate >= from);
        if (query.To is { } to) rows = rows.Where(x => x.DocumentDate <= to);
        var codes = query.CodeParts;
        if (codes.Count == 1) { var pattern = PagingExtensions.ContainsPattern(codes[0]); rows = rows.Where(x => SearchFunctions.Matches(x.Code, pattern)); }
        else if (codes.Count > 1) rows = rows.Where(x => codes.Contains(x.Code));
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = PagingExtensions.ContainsPattern(query.Search);
            rows = rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Note, pattern)
                || SearchFunctions.Matches(x.SupplierName, pattern) || SearchFunctions.Matches(x.SupplierCode, pattern)
                || SearchFunctions.Matches(x.WarehouseCode, pattern)
                || db.Warehouses.Any(w => w.Code == x.WarehouseCode && SearchFunctions.Matches(w.Name, pattern))
                || x.Lines.Any(l => SearchFunctions.Matches(l.MaterialCode, pattern) || SearchFunctions.Matches(l.MaterialName, pattern)));
        }
        return rows;
    }

    /// <summary>A price column cannot be sorted by someone who may not see prices (the order would give them away).</summary>
    private static void EnsureSortAllowed(VoucherListQuery query, bool canSeePrice)
    {
        if (!canSeePrice && string.Equals(query.Sort, "totalValue", StringComparison.OrdinalIgnoreCase))
            throw new BusinessRuleException("paging.sortInvalid");
    }

    public async Task<PagedResult<GoodsReceiptDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        EnsureSortAllowed(query, canSeePrice);
        var rows = await FilterAsync(userId, unitCode, query, ct);
        // The page is cut on the headers; the items of those few receipts are read afterwards.
        var page = await rows.ToPagedAsync(query, SortColumns, ct);
        var ids = page.Items.Select(x => x.Id).ToList();
        var lines = await db.GoodsReceiptLines.AsNoTracking().Where(x => ids.Contains(x.ReceiptId)).ToListAsync(ct);
        foreach (var row in page.Items) row.Lines = lines.Where(x => x.ReceiptId == row.Id).ToList();
        return new PagedResult<GoodsReceiptDto>(await ToDtosAsync(page.Items.ToList(), canSeePrice, ct), page.Total, page.Page, page.PageSize);
    }

    public async Task<ExportFile> ExportAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, Core.Domain.Modules.Users.PermissionAction.Export, ct);
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        EnsureSortAllowed(query, canSeePrice);
        var rows = await FilterAsync(userId, unitCode, query, ct);
        var total = await rows.CountAsync(ct);
        if (total > PagingLimits.MaxExportRows) throw new BusinessRuleException("export.tooMany", PagingLimits.MaxExportRows);
        var list = await SortColumns.Apply(rows, query.Sort, query.Dir).ToListAsync(ct);
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var names = (await statuses.GetNamesAsync(unitCode, ct)).GetValueOrDefault("PNK");
        string StatusName(string status) => names?.GetValueOrDefault(status)?.Name ?? status;
        var columns = new List<ExportColumn<GoodsReceipt>>
        {
            new("export.receipt.code", x => x.Code), new("export.receipt.date", x => x.DocumentDate),
            new("export.receipt.unit", x => units.GetValueOrDefault(x.UnitCode, x.UnitCode)),
            new("export.receipt.warehouse", x => warehouses.GetValueOrDefault(x.WarehouseCode, x.WarehouseCode)),
            new("export.receipt.voucherType", x => x.VoucherType), new("export.receipt.supplier", x => x.SupplierName),
            new("export.receipt.status", x => StatusName(x.Status))
        };
        if (canSeePrice) columns.Add(new("export.receipt.totalValue", x => x.TotalValue));
        var content = excel.Write("export.receipt.sheet", columns, list);
        // RecordAsync only adds the row to the context: it is written by this SaveChanges.
        await audit.RecordAsync(new AuditEntry(Function, "receipt", "export", null, AuditActions.Export, [],
            $"{total} rows; search={query.Search}; status={query.Status}; warehouse={query.Warehouse}; type={query.VoucherType}; code={query.Code}; from={query.From}; to={query.To}"), ct);
        await db.SaveChangesAsync(ct);
        return new ExportFile(content, $"PhieuNhapKho_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    public async Task<GoodsReceiptDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        await EnsureActionAsync(userId, row, DocumentAction.View, ct);
        return (await ToDtosAsync([row], await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct), ct))[0];
    }

    public async Task<GoodsReceiptDto> CreateAsync(int userId, string unitCode, SaveGoodsReceiptRequest request, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, Core.Domain.Modules.Users.PermissionAction.Create, ct);
        var check = await ValidateAsync(unitCode, request, null, ct);
        await ProjectChecks.EnsureAsync(db, request.ProjectCode, null, ct);
        var target = VoucherTargetStatus.Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, unitCode, isOwner: true, target, ct);
        var id = await unitOfWork.ExecuteAsync(async token =>
        {
            var row = new GoodsReceipt
            {
                UnitCode = unitCode, DocumentDate = request.Date, CreatedDate = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            Apply(row, request, check);
            row.Code = await numbers.NextAsync("PNK", unitCode, request.Date, token);
            db.GoodsReceipts.Add(row);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, row.Id, check.Names));
            audit.Attach(row, [new AuditChange("items", null, LineSummary(row.Lines))]);
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
            return row.Id;
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<GoodsReceiptDto> UpdateAsync(int userId, string unitCode, long id,
        SaveGoodsReceiptRequest request, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        // A posted voucher may be changed with the right ST_EDIT_POSTED: reverse the posting, change, post again (all or nothing).
        var posted = row.Status == "Posted";
        if (posted)
        {
            await EnsureActionAsync(userId, row, DocumentAction.View, ct);
            await PostedEdit.EnsureAsync(permissions, userId, Function, row.UnitCode, forDelete: false, ct);
        }
        else
        {
            await EnsureActionAsync(userId, row, DocumentAction.Edit, ct);
            if (row.Status != "Draft") throw new BusinessRuleException("receipt.editDraftOnly");
        }
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        var check = await ValidateAsync(unitCode, request, id, ct);
        await ProjectChecks.EnsureAsync(db, request.ProjectCode, row.ProjectCode, ct);
        var target = posted ? DocumentStatus.Posted : VoucherTargetStatus.Parse(request.TargetStatus);
        if (!posted) await EnsureTargetAllowedAsync(userId, unitCode, row.CreatedBy == userId, target, ct);
        db.ExpectVersion(row, request.Version, touch: true);
        var before = LineSummary(row.Lines);
        await unitOfWork.ExecuteAsync(async token =>
        {
            Apply(row, request, check);
            db.GoodsReceiptLines.RemoveRange(row.Lines);
            row.Lines.Clear();
            audit.Attach(row, [new AuditChange("items", before, LineSummary(Lines(request, id, check.Names)))]);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, id, check.Names));
            await db.SaveChangesAsync(token);
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

    public async Task<GoodsReceiptDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct)
    {
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
            "cancel" => DocumentAction.Cancel, "reopen" => DocumentAction.Reopen, _ => throw new BusinessRuleException("receipt.invalidAction")
        };
        if (normalized == "cancel" && row.Status == "Pending")
            throw new BusinessRuleException("receipt.withdrawBeforeCancel");
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

    /// <summary>
    /// Takes the just saved draft to the status the user asked for, in the same transaction: Pending sends it for approval as
    /// usual; Approved records the approval of every level by this user (they must be an approver of each); Posted then posts it
    /// to the stock ledger. Any refusal rolls the whole save back, so the voucher is never left half way.
    /// </summary>
    private async Task AdvanceAsync(GoodsReceipt row, string unitCode, int userId, DocumentStatus target, CancellationToken token)
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
    /// The ledger posting of a receipt: its item lines (the material lines are the bill of materials, not stock in), valued in the
    /// base currency. The lot number and position typed on a line only go to the ledger for materials that track lots / locations
    /// (until the receipt picks them from the catalogs, other materials may still carry them as plain notes).
    /// </summary>
    private async Task<StockPosting> ToPostingAsync(GoodsReceipt row, string unitCode, CancellationToken ct)
    {
        var codes = row.Lines.Select(x => x.MaterialCode).Distinct().ToList();
        var flags = await db.Materials.AsNoTracking().Where(x => codes.Contains(x.Code))
            .ToDictionaryAsync(x => x.Code, x => (x.TrackLot, x.TrackLocation), ct);
        string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        var lines = row.Lines.Where(x => x.Kind == "ITEM").OrderBy(x => x.LineNo).Select(x =>
        {
            var tracked = flags.GetValueOrDefault(x.MaterialCode);
            return new StockLineInput(x.Id, x.MaterialCode, x.Quantity, x.UomCode, decimal.Round(x.Amount * row.ExchangeRate, 2),
                tracked.TrackLot ? Text(x.LotNumber) : null, null, null, tracked.TrackLocation ? Text(x.Position) : null);
        }).ToList();
        return new StockPosting(Function, row.Id, unitCode, row.WarehouseCode, row.DocumentDate, StockDirection.In, lines);
    }

    /// <summary>
    /// Reopening a cancelled voucher: the lines that follow a line of another voucher must still fit what is left of it (the others
    /// may have taken it while this one was cancelled), and that voucher must still be Approved.
    /// </summary>
    private async Task EnsureLinksStillFitAsync(GoodsReceipt row, CancellationToken ct)
    {
        var lines = row.Lines.Where(l => l.PurchaseOrderLineId != null).ToList();
        if (lines.Count == 0) return;
        var ids = lines.Select(l => l.PurchaseOrderLineId!.Value).Distinct().ToList();
        var sources = await (from l in db.PurchaseOrderLines.AsNoTracking() join o in db.PurchaseOrders.AsNoTracking() on l.OrderId equals o.Id
                             where ids.Contains(l.Id) select new { l.Id, l.Quantity, o.Code, o.Status }).ToListAsync(ct);
        var done = await PurchaseOrderProgress.ReceivedByLineAsync(db, ids, row.Id, ct);
        foreach (var src in sources)
        {
            if (src.Status != "Approved") throw new BusinessRuleException("reopen.sourceNotReady", src.Code);
            var taken = lines.Where(l => l.PurchaseOrderLineId == src.Id).Sum(l => l.Quantity);
            var remaining = src.Quantity - done.GetValueOrDefault(src.Id);
            if (taken > remaining) throw new BusinessRuleException("reopen.exceedsSource", src.Code, remaining.ToString("0.####"));
        }
    }

    public async Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        // A posted voucher is deleted with the right ST_EDIT_POSTED: the posting is reversed first (refused when the stock would go negative).
        var posted = row.Status == "Posted";
        if (posted)
        {
            await EnsureActionAsync(userId, row, DocumentAction.View, ct);
            await PostedEdit.EnsureAsync(permissions, userId, Function, row.UnitCode, forDelete: true, ct);
        }
        else
        {
            await EnsureActionAsync(userId, row, DocumentAction.Cancel, ct);
            if (row.Status != "Draft") throw new BusinessRuleException("receipt.deleteDraftOnly");
        }
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            if (posted) await ledger.UnpostAsync(userId, Function, row.Id, token);
            db.GoodsReceiptLines.RemoveRange(row.Lines);
            db.GoodsReceipts.Remove(row);
            await db.SaveChangesAsync(token);
        }, ct);
    }

    public async Task<GoodsReceiptDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct)
    {
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

    private async Task<GoodsReceipt> FindAsync(long id, string unitCode, CancellationToken ct, bool tracking = false)
    {
        var query = db.GoodsReceipts.Include(x => x.Lines).Where(x => x.Id == id && x.UnitCode == unitCode);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct) ?? throw new NotFoundException("receipt.notFound");
    }

    private async Task<GoodsReceiptDto> ResultAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        return (await ToDtosAsync([row], canSeePrice, ct))[0];
    }

    private async Task EnsureActionAsync(int userId, GoodsReceipt row, DocumentAction action, CancellationToken ct)
    {
        var actor = DocumentActor.For(await permissions.GetEffectiveAsync(userId, ct),
            await permissions.GetRightsAsync(userId, ct), Function, row.CreatedBy == userId, row.UnitCode);
        var decision = DocumentStatusPolicy.Check(action, Enum.Parse<DocumentStatus>(row.Status), actor);
        if (!decision.Allowed) throw new ForbiddenException(decision.Reason ?? "permission.denied");
        if (action == DocumentAction.Submit) await statuses.EnsureEnabledAsync(row.UnitCode, Function, DocumentStatus.Pending, ct);
    }

    /// <summary>What a save found out while checking the request: the exchange rate, the material names and the chosen supplier name.</summary>
    private sealed record Checked(decimal Rate, IReadOnlyDictionary<string, string> Names, string? PartnerName, string? OrderCodes);

    private async Task<Checked> ValidateAsync(string unitCode, SaveGoodsReceiptRequest request, long? receiptId, CancellationToken ct)
    {
        await fiscal.EnsureDateOpenAsync(unitCode, request.Date, ct);
        var warehouseCode = Guard.Code(request.WarehouseCode, 20, "field.warehouseCode");
        if (!await db.Warehouses.AnyAsync(x => x.Code == warehouseCode && x.IsActive, ct))
            throw new BusinessRuleException("receipt.warehouseInvalid");
        // The unit of the receipt must be one of the units the warehouse is for (shared warehouses suit every unit).
        if (!await db.UsableBy(unitCode).AnyAsync(x => x.Code == warehouseCode, ct))
            throw new BusinessRuleException("receipt.warehouseNotForUnit", warehouseCode, unitCode);
        var currencyCode = Guard.Code(request.CurrencyCode, 10, "field.currencyCode");
        if (!await db.Currencies.AnyAsync(x => x.Code == currencyCode && x.IsActive, ct))
            throw new BusinessRuleException("receipt.currencyInvalid");
        var rate = await rates.GetRateAsync(currencyCode, request.Date, ct);
        if (request.Items is null || request.Items.Count == 0) throw new BusinessRuleException("receipt.itemsRequired");
        if (request.Items.Count + (request.MaterialItems?.Count ?? 0) > 500)
            throw new BusinessRuleException("receipt.tooManyLines");
        _ = Guard.Required(request.VoucherType, 100, "field.voucherType");
        _ = Guard.Optional(request.DelivererName, 200, "field.delivererName");
        _ = Guard.Optional(request.Note, 1000, "field.note");
        var all = request.Items.Concat(request.MaterialItems ?? []).ToList();
        foreach (var item in all)
        {
            _ = Guard.Code(item.MaterialCode, 50, "field.materialCode");
            _ = Guard.Code(item.UomCode, 20, "field.uomCode");
            _ = Guard.Optional(item.LotNumber, 64, "field.lotNumber");
            _ = Guard.Optional(item.Position, 100, "field.position");
            if (item.Quantity <= 0 || item.UnitPrice < 0) throw new BusinessRuleException("receipt.lineInvalid");
        }
        // Every line points to a material and a unit of the catalogs (the name of the material is taken from the catalog).
        var materialCodes = all.Select(x => x.MaterialCode.Trim().ToUpperInvariant()).Distinct().ToList();
        var materials = await db.Materials.AsNoTracking().Where(x => materialCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, ct);
        var uomCodes = all.Select(x => x.UomCode.Trim().ToUpperInvariant()).Distinct().ToList();
        var activeUoms = (await db.Uoms.AsNoTracking().Where(x => uomCodes.Contains(x.Code) && x.IsActive).Select(x => x.Code).ToListAsync(ct)).ToHashSet();
        // The item lines (not the bill of materials) are the ones that move stock.
        bool IsStockLine(SaveGoodsReceiptLine line) => request.Items.Any(x => ReferenceEquals(x, line));
        foreach (var item in all)
        {
            var code = item.MaterialCode.Trim().ToUpperInvariant();
            if (!materials.TryGetValue(code, out var material) || !material.IsActive)
                throw new BusinessRuleException("voucherLine.materialInvalid", code);
            if (IsStockLine(item) && !material.IsStockItem) throw new BusinessRuleException("voucherLine.materialNotStock", code);
            if (!activeUoms.Contains(item.UomCode.Trim().ToUpperInvariant()))
                throw new BusinessRuleException("voucherLine.uomInvalid", item.UomCode.Trim().ToUpperInvariant(), code);
            if (IsStockLine(item)) await UomRules.EnsureUsableAsync(db, material, item.UomCode, ct);
            // A material tracked by location needs a location of this warehouse; for other materials the position is only a note.
            var position = item.Position?.Trim().ToUpperInvariant();
            if (IsStockLine(item) && material.TrackLocation && !string.IsNullOrEmpty(position)
                && !await db.StorageLocations.AnyAsync(x => x.Code == position && x.WarehouseCode == warehouseCode, ct))
                throw new BusinessRuleException("voucherLine.locationInvalid", position, warehouseCode);
        }
        var names = materials.ToDictionary(x => x.Key, x => x.Value.Name);
        string? partnerName = Guard.Optional(request.SupplierName, 200, "field.supplierName");
        var supplierCode = request.SupplierCode?.Trim().ToUpperInvariant();
        if (!string.IsNullOrEmpty(supplierCode))
        {
            var supplier = await db.Suppliers.AsNoTracking().FirstOrDefaultAsync(x => x.Code == supplierCode, ct);
            if (supplier is null || !supplier.IsActive) throw new BusinessRuleException("receipt.supplierInvalid", supplierCode);
            partnerName = supplier.Name;
        }
        var orderCodes = await ValidateOrderLinkAsync(unitCode, warehouseCode, currencyCode, supplierCode, request, receiptId, ct);
        return new Checked(rate, names, partnerName, orderCodes);
    }

    /// <summary>
    /// A line that receives a purchase order line: the order must be approved, of this unit, warehouse, supplier and currency; the line
    /// has the same material and unit; and the quantities received from an order line (by this receipt and by the others that are not
    /// cancelled) never pass what was ordered. Lines received without an order are free. Returns the numbers of the orders the lines
    /// follow (comma separated).
    /// </summary>
    private async Task<string?> ValidateOrderLinkAsync(string unitCode, string warehouseCode, string currencyCode, string? supplierCode,
        SaveGoodsReceiptRequest request, long? receiptId, CancellationToken ct)
    {
        var lineIds = request.Items.Where(x => x.PurchaseOrderLineId is not null).Select(x => x.PurchaseOrderLineId!.Value).Distinct().ToList();
        if (lineIds.Count == 0) return null;
        var orders = await db.PurchaseOrders.AsNoTracking().Include(x => x.Lines)
            .Where(x => x.UnitCode == unitCode && x.Lines.Any(l => lineIds.Contains(l.Id))).ToListAsync(ct);
        var owner = new Dictionary<long, (Core.Domain.Modules.Purchasing.Documents.PurchaseOrders.PurchaseOrder Order,
            Core.Domain.Modules.Purchasing.Documents.PurchaseOrders.PurchaseOrderLine Line)>();
        foreach (var o in orders)
        {
            if (o.Status != "Approved") throw new BusinessRuleException("receipt.orderNotApproved", o.Code);
            if (o.WarehouseCode != warehouseCode) throw new BusinessRuleException("receipt.orderWarehouse", o.Code, o.WarehouseCode);
            if (!string.Equals(o.SupplierCode, supplierCode, StringComparison.Ordinal)) throw new BusinessRuleException("receipt.orderSupplier", o.Code, o.SupplierCode);
            if (o.CurrencyCode != currencyCode) throw new BusinessRuleException("receipt.orderCurrency", o.Code, o.CurrencyCode);
            foreach (var l in o.Lines) owner[l.Id] = (o, l);
        }
        var received = await PurchaseOrderProgress.ReceivedByLineAsync(db, owner.Keys.ToList(), receiptId, ct);
        var taken = new Dictionary<long, decimal>();
        foreach (var item in request.Items.Where(x => x.PurchaseOrderLineId is not null))
        {
            var material = item.MaterialCode.Trim().ToUpperInvariant();
            if (item.PurchaseOrderLineId is not long lineId || !owner.TryGetValue(lineId, out var found))
                throw new BusinessRuleException("receipt.lineNotInOrder", material);
            var (order, line) = found;
            if (line.MaterialCode != material || line.UomCode != item.UomCode.Trim().ToUpperInvariant())
                throw new BusinessRuleException("receipt.orderLineMismatch", material, order.Code);
            taken[lineId] = taken.GetValueOrDefault(lineId) + item.Quantity;
            var remaining = line.Quantity - received.GetValueOrDefault(lineId);
            if (taken[lineId] > remaining) throw new BusinessRuleException("receipt.exceedsOrder", material, remaining.ToString("0.####"), order.Code);
        }
        return string.Join(",", orders.Select(x => x.Code).Order(StringComparer.Ordinal));
    }

    private static void Apply(GoodsReceipt row, SaveGoodsReceiptRequest request, Checked check)
    {
        row.DocumentDate = request.Date;
        row.WarehouseCode = request.WarehouseCode.Trim().ToUpperInvariant();
        row.VoucherType = request.VoucherType.Trim();
        row.CurrencyCode = request.CurrencyCode.Trim().ToUpperInvariant();
        row.ExchangeRate = check.Rate;
        row.SupplierCode = string.IsNullOrWhiteSpace(request.SupplierCode) ? null : request.SupplierCode.Trim().ToUpperInvariant();
        row.SupplierName = check.PartnerName?.Trim();
        row.DelivererName = request.DelivererName?.Trim();
        row.PurchaseOrderCode = check.OrderCodes;
        row.Note = request.Note?.Trim();
        row.ProjectCode = ProjectChecks.Normalize(request.ProjectCode);
        row.TotalValue = decimal.Round(request.Items.Sum(x => x.Quantity * x.UnitPrice) * check.Rate, 2);
    }

    private static List<GoodsReceiptLine> Lines(SaveGoodsReceiptRequest request, long id, IReadOnlyDictionary<string, string> names)
    {
        var lines = new List<GoodsReceiptLine>();
        void Add(IEnumerable<SaveGoodsReceiptLine> source, string kind)
        {
            var number = 0;
            foreach (var item in source)
                lines.Add(new GoodsReceiptLine
                {
                    ReceiptId = id, Kind = kind, LineNo = ++number,
                    MaterialCode = item.MaterialCode.Trim().ToUpperInvariant(),
                    MaterialName = names.GetValueOrDefault(item.MaterialCode.Trim().ToUpperInvariant(), string.Empty),
                    UomCode = item.UomCode.Trim().ToUpperInvariant(), Quantity = item.Quantity, UnitPrice = item.UnitPrice,
                    Amount = decimal.Round(item.Quantity * item.UnitPrice, 2),
                    LotNumber = item.LotNumber?.Trim(), Position = item.Position?.Trim(),
                    PurchaseOrderLineId = kind == "ITEM" ? item.PurchaseOrderLineId : null
                });
        }
        Add(request.Items, "ITEM");
        Add(request.MaterialItems ?? [], "MATERIAL");
        return lines;
    }

    private static string LineSummary(IEnumerable<GoodsReceiptLine> lines) =>
        string.Join("; ", lines.OrderBy(x => x.Kind).ThenBy(x => x.LineNo)
            .Select(x => $"{x.Kind}:{x.MaterialCode} {x.Quantity} {x.UomCode} x {x.UnitPrice}"));

    private async Task<IReadOnlyList<GoodsReceiptDto>> ToDtosAsync(List<GoodsReceipt> rows, bool canSeePrice, CancellationToken ct)
    {
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var ids = rows.SelectMany(x => new int?[] { x.CreatedBy, x.ApprovedByUserId }).Where(x => x.HasValue)
            .Select(x => x!.Value).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        // The number of the purchase order each line receives, shown on the line.
        var orderLineIds = rows.SelectMany(x => x.Lines).Where(l => l.PurchaseOrderLineId != null)
            .Select(l => l.PurchaseOrderLineId!.Value).Distinct().ToList();
        var orderInfo = orderLineIds.Count == 0 ? []
            : await (from ol in db.PurchaseOrderLines.AsNoTracking() join o in db.PurchaseOrders.AsNoTracking() on ol.OrderId equals o.Id
                     where orderLineIds.Contains(ol.Id) select new { ol.Id, o.Code, Due = ol.DeliveryDate ?? o.DeliveryDate }).ToDictionaryAsync(x => x.Id, ct);
        var orderCodes = orderInfo.ToDictionary(x => x.Key, x => x.Value.Code);
        return rows.Select(row =>
        {
            GoodsReceiptLineDto Line(GoodsReceiptLine line) => new(line.Id, line.Kind, line.MaterialCode, line.MaterialName,
                line.UomCode, line.Quantity, canSeePrice ? line.UnitPrice : 0,
                canSeePrice ? line.Amount : 0, line.LotNumber, line.Position, line.PurchaseOrderLineId,
                line.PurchaseOrderLineId is long orderLineId ? orderCodes.GetValueOrDefault(orderLineId) : null,
                line.PurchaseOrderLineId is long dueLineId && orderInfo.TryGetValue(dueLineId, out var due) ? due.Due : null);
            return new GoodsReceiptDto(row.Id, row.Code, row.DocumentDate, row.CreatedDate,
                row.UnitCode, units.GetValueOrDefault(row.UnitCode, row.UnitCode),
                row.WarehouseCode, warehouses.GetValueOrDefault(row.WarehouseCode, row.WarehouseCode),
                row.VoucherType, row.CurrencyCode, row.ExchangeRate, row.SupplierCode, row.SupplierName, row.DelivererName,
                row.Note, row.Status, canSeePrice ? row.TotalValue : 0,
                users.GetValueOrDefault(row.CreatedBy ?? 0, ""),
                row.ApprovedByUserId is int approved ? users.GetValueOrDefault(approved) : null,
                row.Lines.Where(x => x.Kind == "ITEM").OrderBy(x => x.LineNo).Select(Line).ToList(),
                row.Lines.Where(x => x.Kind == "MATERIAL").OrderBy(x => x.LineNo).Select(Line).ToList(), row.Version, row.PurchaseOrderCode, ProjectCode: row.ProjectCode);
        }).ToList();
    }
}
