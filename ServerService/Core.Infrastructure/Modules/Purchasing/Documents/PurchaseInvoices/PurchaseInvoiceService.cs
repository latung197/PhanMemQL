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
using Core.Application.Modules.Purchasing.Documents.PurchaseInvoices;
using Core.Application.Modules.Users;
using Core.Application.Modules.VoucherStatuses;
using Core.Application.Modules.VoucherNumbering;
using Core.Domain.Modules.Purchasing.Documents.PurchaseInvoices;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Modules.Inventory;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Purchasing.Documents.PurchaseInvoices;

/// <summary>
/// What invoices already bill of the lines of goods receipts and orders: the sum of the quantities of the invoice lines that point to a
/// line (<c>goods_receipt_line_id</c> / <c>purchase_order_line_id</c>), on invoices that are not cancelled. Nothing is stored on the
/// source: cancelling or deleting an invoice gives its quantity back.
/// </summary>
public static class PurchaseInvoiceProgress
{
    public static async Task<Dictionary<long, decimal>> InvoicedByReceiptLineAsync(CoreContext db, IReadOnlyCollection<long> receiptLineIds,
        long? exceptInvoiceId, CancellationToken ct)
    {
        if (receiptLineIds.Count == 0) return [];
        var rows = await (from line in db.PurchaseInvoiceLines.AsNoTracking()
                          join invoice in db.PurchaseInvoices.AsNoTracking() on line.InvoiceId equals invoice.Id
                          where line.GoodsReceiptLineId != null && receiptLineIds.Contains(line.GoodsReceiptLineId.Value)
                                && invoice.Status != "Cancelled" && (exceptInvoiceId == null || invoice.Id != exceptInvoiceId)
                          select new { LineId = line.GoodsReceiptLineId!.Value, line.Quantity }).ToListAsync(ct);
        return rows.GroupBy(x => x.LineId).ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));
    }

    public static async Task<Dictionary<long, decimal>> InvoicedByOrderLineAsync(CoreContext db, IReadOnlyCollection<long> orderLineIds,
        long? exceptInvoiceId, CancellationToken ct)
    {
        if (orderLineIds.Count == 0) return [];
        var rows = await (from line in db.PurchaseInvoiceLines.AsNoTracking()
                          join invoice in db.PurchaseInvoices.AsNoTracking() on line.InvoiceId equals invoice.Id
                          where line.PurchaseOrderLineId != null && orderLineIds.Contains(line.PurchaseOrderLineId.Value)
                                && invoice.Status != "Cancelled" && (exceptInvoiceId == null || invoice.Id != exceptInvoiceId)
                          select new { LineId = line.PurchaseOrderLineId!.Value, line.Quantity }).ToListAsync(ct);
        return rows.GroupBy(x => x.LineId).ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));
    }

    /// <summary>True when an invoice that is not cancelled bills a line of the goods receipt.</summary>
    public static Task<bool> HasInvoicesForReceiptAsync(CoreContext db, long receiptId, CancellationToken ct) =>
        (from line in db.PurchaseInvoiceLines.AsNoTracking()
         join invoice in db.PurchaseInvoices.AsNoTracking() on line.InvoiceId equals invoice.Id
         join rl in db.GoodsReceiptLines.AsNoTracking() on line.GoodsReceiptLineId equals (long?)rl.Id
         where rl.ReceiptId == receiptId && invoice.Status != "Cancelled"
         select line.Id).AnyAsync(ct);

    /// <summary>True when an invoice that is not cancelled bills a line of the order (directly or through a receipt of the order).</summary>
    public static Task<bool> HasInvoicesForOrderAsync(CoreContext db, long orderId, CancellationToken ct) =>
        (from line in db.PurchaseInvoiceLines.AsNoTracking()
         join invoice in db.PurchaseInvoices.AsNoTracking() on line.InvoiceId equals invoice.Id
         join ol in db.PurchaseOrderLines.AsNoTracking() on line.PurchaseOrderLineId equals (long?)ol.Id
         where ol.OrderId == orderId && invoice.Status != "Cancelled"
         select line.Id).AnyAsync(ct);
}

/// <summary>
/// Hóa đơn mua hàng. Same layout, statuses, approval and "save at a status" flow as the purchase order, and nothing is posted to a
/// ledger yet: the invoice says what is owed to a supplier (the payables report adds the approved ones up). The lines may bill lines of
/// goods receipts and / or approved orders of the same supplier and currency; the quantity billed never passes what was received (or
/// ordered). The tax is one rate for the whole invoice; the price is the one on the invoice, even when it differs from the order.
/// </summary>
public sealed class PurchaseInvoiceService(CoreContext db, IUnitOfWork unitOfWork, IVoucherNumberService numbers,
    IFiscalPeriodService fiscal, IExchangeRateService rates, IPermissionService permissions,
    IDocumentApprovalService approvals, IAuditLog audit, IVoucherStatusService statuses, IExcelExporter excel) : IPurchaseInvoiceService
{
    private const string Function = "pur_invoice";
    private static readonly string[] BillableReceiptStatuses = ["Approved", "Posted"];

    public async Task<PurchaseInvoiceOptionsDto> GetOptionsAsync(CancellationToken ct) => new(
        await db.Currencies.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new PurchaseInvoiceOption(x.Code, x.Name)).ToListAsync(ct),
        await db.Suppliers.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new PurchaseInvoiceOption(x.Code, x.Name)).ToListAsync(ct),
        await db.TaxRates.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new PurchaseInvoiceTaxOption(x.Code, x.Name, x.IsExempt ? 0 : x.Rate)).ToListAsync(ct));

    private static readonly SortMap<PurchaseInvoice> SortColumns = SortMap<PurchaseInvoice>.By(x => x.Id, "date", defaultDescending: true)
        .Add("date", x => x.DocumentDate).Add("code", x => x.Code).Add("voucherType", x => x.VoucherType)
        .Add("supplier", x => x.SupplierName).Add("status", x => x.Status).Add("totalValue", x => x.TotalValue)
        .Add("invoiceNo", x => x.InvoiceNo).Add("invoiceDate", x => x.InvoiceDate).Add("dueDate", x => x.DueDate).AddRecordStamps();

    /// <summary>The vouchers of the unit the user may see that the query's filters leave.</summary>
    private async Task<IQueryable<PurchaseInvoice>> FilterAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var rows = db.PurchaseInvoices.AsNoTracking().Where(x => x.UnitCode == unitCode);
        if (!await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewAll, ct)) rows = rows.Where(x => x.CreatedBy == userId);
        if (query.StatusFilter is { } status) { var text = status.ToString(); rows = rows.Where(x => x.Status == text); }
        if (!string.IsNullOrWhiteSpace(query.Project)) { var pj = query.Project.Trim().ToUpperInvariant(); rows = rows.Where(x => x.ProjectCode == pj); }
        if (!string.IsNullOrWhiteSpace(query.VoucherType)) { var type = query.VoucherType.Trim(); rows = rows.Where(x => x.VoucherType == type); }
        if (!string.IsNullOrWhiteSpace(query.Supplier)) { var supplier = query.Supplier.Trim().ToUpperInvariant(); rows = rows.Where(x => x.SupplierCode == supplier); }
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
                || SearchFunctions.Matches(x.InvoiceNo, pattern) || SearchFunctions.Matches(x.InvoiceSeries, pattern)
                || SearchFunctions.Matches(x.PurchaseOrderCode, pattern) || SearchFunctions.Matches(x.GoodsReceiptCode, pattern)
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

    public async Task<PagedResult<PurchaseInvoiceDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        EnsureSortAllowed(query, canSeePrice);
        var rows = await FilterAsync(userId, unitCode, query, ct);
        // The page is cut on the headers; the items of those few vouchers are read afterwards.
        var page = await rows.ToPagedAsync(query, SortColumns, ct);
        var ids = page.Items.Select(x => x.Id).ToList();
        var lines = await db.PurchaseInvoiceLines.AsNoTracking().Where(x => ids.Contains(x.InvoiceId)).ToListAsync(ct);
        foreach (var row in page.Items) row.Lines = lines.Where(x => x.InvoiceId == row.Id).ToList();
        return new PagedResult<PurchaseInvoiceDto>(await ToDtosAsync(page.Items.ToList(), canSeePrice, ct), page.Total, page.Page, page.PageSize);
    }

    public async Task<ExportFile> ExportAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, PermissionAction.Export, ct);
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        EnsureSortAllowed(query, canSeePrice);
        var rows = await FilterAsync(userId, unitCode, query, ct);
        var total = await rows.CountAsync(ct);
        if (total > PagingLimits.MaxExportRows) throw new BusinessRuleException("export.tooMany", PagingLimits.MaxExportRows);
        var list = await SortColumns.Apply(rows, query.Sort, query.Dir).ToListAsync(ct);
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var names = (await statuses.GetNamesAsync(unitCode, ct)).GetValueOrDefault("HDM");
        string StatusName(string status) => names?.GetValueOrDefault(status)?.Name ?? status;
        var columns = new List<ExportColumn<PurchaseInvoice>>
        {
            new("export.purchaseInvoice.code", x => x.Code), new("export.purchaseInvoice.date", x => x.DocumentDate),
            new("export.purchaseInvoice.unit", x => units.GetValueOrDefault(x.UnitCode, x.UnitCode)),
            new("export.purchaseInvoice.supplier", x => x.SupplierName),
            new("export.purchaseInvoice.invoiceNo", x => x.InvoiceNo), new("export.purchaseInvoice.invoiceSeries", x => x.InvoiceSeries),
            new("export.purchaseInvoice.invoiceDate", x => x.InvoiceDate), new("export.purchaseInvoice.dueDate", x => x.DueDate),
            new("export.purchaseInvoice.voucherType", x => x.VoucherType),
            new("export.purchaseInvoice.paymentTerms", x => x.PaymentTerms),
            new("export.purchaseInvoice.status", x => StatusName(x.Status))
        };
        if (canSeePrice)
        {
            columns.Add(new("export.purchaseInvoice.subTotal", x => x.SubTotal));
            columns.Add(new("export.purchaseInvoice.taxAmount", x => x.TaxAmount));
            columns.Add(new("export.purchaseInvoice.totalValue", x => x.TotalValue));
        }
        var content = excel.Write("export.purchaseInvoice.sheet", columns, list);
        // RecordAsync only adds the row to the context: it is written by this SaveChanges.
        await audit.RecordAsync(new AuditEntry(Function, "purchaseInvoice", "export", null, AuditActions.Export, [],
            $"{total} rows; search={query.Search}; status={query.Status}; supplier={query.Supplier}; type={query.VoucherType}; code={query.Code}; from={query.From}; to={query.To}"), ct);
        await db.SaveChangesAsync(ct);
        return new ExportFile(content, $"HoaDonMuaHang_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    public async Task<PurchaseInvoiceDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        await EnsureActionAsync(userId, row, DocumentAction.View, ct);
        return (await ToDtosAsync([row], await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct), ct))[0];
    }

    public async Task<IReadOnlyList<OpenInvoiceReceiptDto>> GetOpenReceiptsAsync(int userId, string unitCode, string? supplier, long? exceptInvoiceId, CancellationToken ct)
    {
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        var query = db.GoodsReceipts.AsNoTracking().Include(x => x.Lines)
            .Where(x => x.UnitCode == unitCode && x.SupplierCode != null && BillableReceiptStatuses.Contains(x.Status));
        if (!string.IsNullOrWhiteSpace(supplier)) { var code = supplier.Trim().ToUpperInvariant(); query = query.Where(x => x.SupplierCode == code); }
        var rows = await query.OrderByDescending(x => x.DocumentDate).ThenByDescending(x => x.Id).ToListAsync(ct);
        var lineIds = rows.SelectMany(x => x.Lines).Where(l => l.Kind == "ITEM").Select(x => x.Id).ToList();
        var invoiced = await PurchaseInvoiceProgress.InvoicedByReceiptLineAsync(db, lineIds, exceptInvoiceId, ct);
        var orderLineIds = rows.SelectMany(x => x.Lines).Where(l => l.PurchaseOrderLineId != null).Select(l => l.PurchaseOrderLineId!.Value).Distinct().ToList();
        var orders = orderLineIds.Count == 0 ? []
            : await (from ol in db.PurchaseOrderLines.AsNoTracking() join o in db.PurchaseOrders.AsNoTracking() on ol.OrderId equals o.Id
                     where orderLineIds.Contains(ol.Id) select new { ol.Id, o.Code, o.TaxRateCode, o.PaymentTermCode }).ToDictionaryAsync(x => x.Id, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var result = new List<OpenInvoiceReceiptDto>();
        foreach (var row in rows)
        {
            var lines = row.Lines.Where(l => l.Kind == "ITEM").OrderBy(x => x.LineNo).Select(x =>
            {
                var done = invoiced.GetValueOrDefault(x.Id);
                var order = x.PurchaseOrderLineId is long ol ? orders.GetValueOrDefault(ol) : null;
                return new OpenInvoiceReceiptLineDto(x.Id, x.MaterialCode, x.MaterialName, x.UomCode, x.Quantity, done, x.Quantity - done,
                    canSeePrice ? x.UnitPrice : 0, null, x.PurchaseOrderLineId, order?.Code);
            }).Where(x => x.RemainingQuantity > 0).ToList();
            if (lines.Count == 0) continue;
            var firstOrder = row.Lines.Where(l => l.PurchaseOrderLineId != null).Select(l => orders.GetValueOrDefault(l.PurchaseOrderLineId!.Value)).FirstOrDefault(o => o is not null);
            result.Add(new OpenInvoiceReceiptDto(row.Id, row.Code, row.DocumentDate, row.WarehouseCode,
                warehouses.GetValueOrDefault(row.WarehouseCode, row.WarehouseCode), row.SupplierCode!, row.SupplierName, row.CurrencyCode,
                row.ExchangeRate, row.Note, lines, row.ProjectCode, firstOrder?.TaxRateCode, firstOrder?.PaymentTermCode));
        }
        return result;
    }

    public async Task<IReadOnlyList<OpenInvoiceOrderDto>> GetOpenOrdersAsync(int userId, string unitCode, string? supplier, long? exceptInvoiceId, CancellationToken ct)
    {
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        var query = db.PurchaseOrders.AsNoTracking().Include(x => x.Lines).Where(x => x.UnitCode == unitCode && x.Status == "Approved");
        if (!string.IsNullOrWhiteSpace(supplier)) { var code = supplier.Trim().ToUpperInvariant(); query = query.Where(x => x.SupplierCode == code); }
        var rows = await query.OrderByDescending(x => x.DocumentDate).ThenByDescending(x => x.Id).ToListAsync(ct);
        var lineIds = rows.SelectMany(x => x.Lines).Select(x => x.Id).ToList();
        var invoiced = await PurchaseInvoiceProgress.InvoicedByOrderLineAsync(db, lineIds, exceptInvoiceId, ct);
        var received = await Core.Infrastructure.Modules.Purchasing.Documents.PurchaseOrders.PurchaseOrderProgress.ReceivedByLineAsync(db, lineIds, null, ct);
        var result = new List<OpenInvoiceOrderDto>();
        foreach (var row in rows)
        {
            var lines = row.Lines.OrderBy(x => x.LineNo).Select(x =>
            {
                var done = invoiced.GetValueOrDefault(x.Id);
                return new OpenInvoiceOrderLineDto(x.Id, x.MaterialCode, x.MaterialName, x.UomCode, x.Quantity, received.GetValueOrDefault(x.Id),
                    done, x.Quantity - done, canSeePrice ? x.UnitPrice : 0, x.Note);
            }).Where(x => x.RemainingQuantity > 0).ToList();
            if (lines.Count == 0) continue;
            result.Add(new OpenInvoiceOrderDto(row.Id, row.Code, row.DocumentDate, row.SupplierCode, row.SupplierName, row.CurrencyCode,
                row.ExchangeRate, row.TaxRateCode, row.PaymentTermCode, row.PaymentTerms, row.Note, lines, row.ProjectCode));
        }
        return result;
    }

    public async Task<PurchaseInvoiceDto> CreateAsync(int userId, string unitCode, SavePurchaseInvoiceRequest request, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, PermissionAction.Create, ct);
        var check = await ValidateAsync(unitCode, request, null, ct);
        await ProjectChecks.EnsureAsync(db, request.ProjectCode, null, ct);
        var target = Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, unitCode, isOwner: true, target, ct);
        var id = await unitOfWork.ExecuteAsync(async token =>
        {
            var row = new PurchaseInvoice
            {
                UnitCode = unitCode, DocumentDate = request.Date, CreatedDate = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            Apply(row, request, check);
            row.Code = await numbers.NextAsync("HDM", unitCode, request.Date, token);
            db.PurchaseInvoices.Add(row);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, row.Id, check));
            audit.Attach(row, [new AuditChange("items", null, LineSummary(row.Lines))]);
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
            return row.Id;
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<PurchaseInvoiceDto> UpdateAsync(int userId, string unitCode, long id,
        SavePurchaseInvoiceRequest request, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Edit, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("purchaseInvoice.editDraftOnly");
        // Someone who may not see prices got 0 in the form: keep the prices already saved (matched by line and material), never overwrite them with 0.
        if (request.Items is not null && !await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct))
            request = request with { Items = request.Items.Select((item, index) => KeepPrice(item, row.Lines, index)).ToList() };
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        var check = await ValidateAsync(unitCode, request, id, ct);
        await ProjectChecks.EnsureAsync(db, request.ProjectCode, row.ProjectCode, ct);
        var target = Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, unitCode, row.CreatedBy == userId, target, ct);
        db.ExpectVersion(row, request.Version, touch: true);
        var before = LineSummary(row.Lines);
        await unitOfWork.ExecuteAsync(async token =>
        {
            Apply(row, request, check);
            db.PurchaseInvoiceLines.RemoveRange(row.Lines);
            row.Lines.Clear();
            audit.Attach(row, [new AuditChange("items", before, LineSummary(Lines(request, id, check)))]);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, id, check));
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<PurchaseInvoiceDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct)
    {
        await PermissionGate.EnsureTouchAsync(permissions, userId, Function, ct);
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
        // An invoice is never posted: only submit, approve, cancel and reopen.
        var policyAction = normalized switch
        {
            "submit" => DocumentAction.Submit, "approve" => DocumentAction.Approve,
            "cancel" => DocumentAction.Cancel, "reopen" => DocumentAction.Reopen, _ => throw new BusinessRuleException("purchaseInvoice.invalidAction")
        };
        if (normalized == "cancel" && row.Status == "Pending")
            throw new BusinessRuleException("purchaseInvoice.withdrawBeforeCancel");
        await EnsureActionAsync(userId, row, policyAction, ct);
        if (normalized == "reopen") await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
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
                // Approving is a status right: a draft, or every level still open, is approved at once by this user.
                await approvals.ApproveToEndAsync(userId, unitCode, Function, row.Code, row.Code, token);
                row.Status = "Approved";
                row.ApprovedByUserId = userId;
            }
            else if (normalized == "reopen")
            {
                // A cancelled voucher comes back as a draft: what it bills must still have room for it, and its number must still be free.
                await EnsureNotDuplicateAsync(row.SupplierCode, row.InvoiceNo, row.InvoiceSeries, row.Id, token);
                await EnsureLinksStillFitAsync(row, token);
                row.Status = "Draft";
                row.ApprovedByUserId = null;
            }
            else row.Status = "Cancelled";
            await db.SaveChangesAsync(token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    /// <summary>The status to save at: Draft, Pending or Approved (an invoice has no Posted status).</summary>
    private static DocumentStatus Parse(string? value)
    {
        var target = VoucherTargetStatus.Parse(value);
        if (target == DocumentStatus.Posted) throw new BusinessRuleException("purchaseInvoice.noPosting");
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
        // The step that is switched off is skipped, not refused: only saving at it (Pending) needs it in use.
        if (target == DocumentStatus.Pending) await statuses.EnsureEnabledAsync(unitCode, Function, DocumentStatus.Pending, ct);
    }

    /// <summary>Takes the just saved draft to the status the user asked for, in the same transaction (see GoodsReceiptService.AdvanceAsync).</summary>
    private async Task AdvanceAsync(PurchaseInvoice row, string unitCode, int userId, DocumentStatus target, CancellationToken token)
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
    }

    /// <summary>
    /// Reopening a cancelled voucher: the lines that bill a line of a receipt or an order must still fit what is left of it (the other
    /// invoices may have taken it while this one was cancelled), and that receipt / order must still be billable.
    /// </summary>
    private async Task EnsureLinksStillFitAsync(PurchaseInvoice row, CancellationToken ct)
    {
        var receiptLineIds = row.Lines.Where(l => l.GoodsReceiptLineId != null).Select(l => l.GoodsReceiptLineId!.Value).Distinct().ToList();
        if (receiptLineIds.Count > 0)
        {
            var sources = await (from l in db.GoodsReceiptLines.AsNoTracking() join r in db.GoodsReceipts.AsNoTracking() on l.ReceiptId equals r.Id
                                 where receiptLineIds.Contains(l.Id) select new { l.Id, l.Quantity, r.Code, r.Status }).ToListAsync(ct);
            var done = await PurchaseInvoiceProgress.InvoicedByReceiptLineAsync(db, receiptLineIds, row.Id, ct);
            foreach (var src in sources)
            {
                if (!BillableReceiptStatuses.Contains(src.Status)) throw new BusinessRuleException("reopen.sourceNotReady", src.Code);
                var taken = row.Lines.Where(l => l.GoodsReceiptLineId == src.Id).Sum(l => l.Quantity);
                var remaining = src.Quantity - done.GetValueOrDefault(src.Id);
                if (taken > remaining) throw new BusinessRuleException("reopen.exceedsSource", src.Code, remaining.ToString("0.####"));
            }
        }
        var orderLineIds = row.Lines.Where(l => l.PurchaseOrderLineId != null).Select(l => l.PurchaseOrderLineId!.Value).Distinct().ToList();
        if (orderLineIds.Count > 0)
        {
            var sources = await (from l in db.PurchaseOrderLines.AsNoTracking() join o in db.PurchaseOrders.AsNoTracking() on l.OrderId equals o.Id
                                 where orderLineIds.Contains(l.Id) select new { l.Id, l.Quantity, o.Code, o.Status }).ToListAsync(ct);
            var done = await PurchaseInvoiceProgress.InvoicedByOrderLineAsync(db, orderLineIds, row.Id, ct);
            foreach (var src in sources)
            {
                if (src.Status != "Approved") throw new BusinessRuleException("reopen.sourceNotReady", src.Code);
                var taken = row.Lines.Where(l => l.PurchaseOrderLineId == src.Id).Sum(l => l.Quantity);
                var remaining = src.Quantity - done.GetValueOrDefault(src.Id);
                if (taken > remaining) throw new BusinessRuleException("reopen.exceedsSource", src.Code, remaining.ToString("0.####"));
            }
        }
    }

    public async Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Cancel, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("purchaseInvoice.deleteDraftOnly");
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            db.PurchaseInvoiceLines.RemoveRange(row.Lines);
            db.PurchaseInvoices.Remove(row);
            await db.SaveChangesAsync(token);
        }, ct);
    }

    public async Task<PurchaseInvoiceDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct)
    {
        await PermissionGate.EnsureTouchAsync(permissions, userId, Function, ct);
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

    private async Task<PurchaseInvoice> FindAsync(long id, string unitCode, CancellationToken ct, bool tracking = false)
    {
        var query = db.PurchaseInvoices.Include(x => x.Lines).Where(x => x.Id == id && x.UnitCode == unitCode);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct) ?? throw new NotFoundException("purchaseInvoice.notFound");
    }

    private async Task<PurchaseInvoiceDto> ResultAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        return (await ToDtosAsync([row], canSeePrice, ct))[0];
    }

    private async Task EnsureActionAsync(int userId, PurchaseInvoice row, DocumentAction action, CancellationToken ct)
    {
        var actor = DocumentActor.For(await permissions.GetEffectiveAsync(userId, ct),
            await permissions.GetRightsAsync(userId, ct), Function, row.CreatedBy == userId, row.UnitCode);
        var decision = DocumentStatusPolicy.Check(action, Enum.Parse<DocumentStatus>(row.Status), actor);
        if (!decision.Allowed) throw new ForbiddenException(decision.Reason ?? "permission.denied");
        if (action == DocumentAction.Submit) await statuses.EnsureEnabledAsync(row.UnitCode, Function, DocumentStatus.Pending, ct);
    }

    /// <summary>
    /// What a save found out while checking the invoice: the rate, the material names, the supplier, the tax, the payment term and due
    /// date, the order line each item bills (the one typed or the one of its receipt line) and the numbers of the vouchers it follows.
    /// </summary>
    private sealed record Checked(decimal Rate, IReadOnlyDictionary<string, string> Names, string SupplierCode, string SupplierName,
        string? TaxRateCode, decimal TaxRate, string? PaymentTermCode, string? PaymentTermsText, DateOnly DueDate,
        IReadOnlyList<long?> OrderLineIds, string? OrderCodes, string? ReceiptCodes, string InvoiceNo, string? InvoiceSeries);

    private async Task<Checked> ValidateAsync(string unitCode, SavePurchaseInvoiceRequest request, long? invoiceId, CancellationToken ct)
    {
        await fiscal.EnsureDateOpenAsync(unitCode, request.Date, ct);
        var currencyCode = Guard.Code(request.CurrencyCode, 10, "field.currencyCode");
        if (!await db.Currencies.AnyAsync(x => x.Code == currencyCode && x.IsActive, ct))
            throw new BusinessRuleException("purchaseInvoice.currencyInvalid");
        var rate = await rates.GetRateAsync(currencyCode, request.Date, ct);
        if (request.Items is null || request.Items.Count == 0) throw new BusinessRuleException("purchaseInvoice.itemsRequired");
        if (request.Items.Count > 500) throw new BusinessRuleException("purchaseInvoice.tooManyLines");
        _ = Guard.Required(request.VoucherType, 100, "field.purchaseInvoiceType");
        var invoiceNo = Guard.Required(request.InvoiceNo, 50, "field.invoiceNo").ToUpperInvariant();
        var series = Guard.Optional(request.InvoiceSeries, 30, "field.invoiceSeries")?.ToUpperInvariant();
        _ = Guard.Optional(request.PaymentTerms, 200, "field.paymentTerms");
        _ = Guard.Optional(request.Note, 1000, "field.note");
        if (request.InvoiceDate > request.Date) throw new BusinessRuleException("purchaseInvoice.invoiceDateInvalid");
        var supplierCode = Guard.Code(request.SupplierCode, 20, "field.supplierCode");
        var supplier = await db.Suppliers.AsNoTracking().FirstOrDefaultAsync(x => x.Code == supplierCode, ct);
        if (supplier is null || !supplier.IsActive) throw new BusinessRuleException("purchaseInvoice.supplierInvalid", supplierCode);
        await EnsureNotDuplicateAsync(supplier.Code, invoiceNo, series, invoiceId, ct);
        // A payment term of the catalog gives its name to the invoice and, when no due date is typed, the days to pay.
        string? termCode = null;
        var termsText = request.PaymentTerms?.Trim();
        var days = 0;
        if (!string.IsNullOrWhiteSpace(request.PaymentTermCode))
        {
            termCode = request.PaymentTermCode.Trim().ToUpperInvariant();
            var term = await db.PaymentTerms.AsNoTracking().FirstOrDefaultAsync(x => x.Code == termCode, ct);
            if (term is null || !term.IsActive) throw new BusinessRuleException("paymentTerm.invalid", termCode);
            termsText = term.Name;
            days = term.Days;
        }
        var due = request.DueDate ?? request.InvoiceDate.AddDays(days);
        if (due < request.InvoiceDate) throw new BusinessRuleException("purchaseInvoice.dueDateInvalid");
        string? taxCode = null;
        decimal taxRate = 0;
        if (!string.IsNullOrWhiteSpace(request.TaxRateCode))
        {
            taxCode = request.TaxRateCode.Trim().ToUpperInvariant();
            var tax = await db.TaxRates.AsNoTracking().FirstOrDefaultAsync(x => x.Code == taxCode, ct);
            if (tax is null || !tax.IsActive) throw new BusinessRuleException("purchaseInvoice.taxInvalid", taxCode);
            taxRate = tax.IsExempt ? 0 : tax.Rate;
        }
        foreach (var item in request.Items)
        {
            _ = Guard.Code(item.MaterialCode, 50, "field.materialCode");
            _ = Guard.Code(item.UomCode, 20, "field.uomCode");
            _ = Guard.Optional(item.Note, 300, "field.note");
            if (item.Quantity <= 0 || item.UnitPrice < 0) throw new BusinessRuleException("purchaseInvoice.lineInvalid");
        }
        // Every line points to a material and a unit of the catalogs (a service material is fine: the line need not be a stock item).
        var materialCodes = request.Items.Select(x => x.MaterialCode.Trim().ToUpperInvariant()).Distinct().ToList();
        var materials = await db.Materials.AsNoTracking().Where(x => materialCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, ct);
        var uomCodes = request.Items.Select(x => x.UomCode.Trim().ToUpperInvariant()).Distinct().ToList();
        var activeUoms = (await db.Uoms.AsNoTracking().Where(x => uomCodes.Contains(x.Code) && x.IsActive).Select(x => x.Code).ToListAsync(ct)).ToHashSet();
        foreach (var item in request.Items)
        {
            var code = item.MaterialCode.Trim().ToUpperInvariant();
            if (!materials.TryGetValue(code, out var material) || !material.IsActive)
                throw new BusinessRuleException("voucherLine.materialInvalid", code);
            if (!activeUoms.Contains(item.UomCode.Trim().ToUpperInvariant()))
                throw new BusinessRuleException("voucherLine.uomInvalid", item.UomCode.Trim().ToUpperInvariant(), code);
            await UomRules.EnsureUsableAsync(db, material, item.UomCode, ct);
        }
        var links = await ValidateLinksAsync(unitCode, supplier.Code, currencyCode, request, invoiceId, ct);
        return new Checked(rate, materials.ToDictionary(x => x.Key, x => x.Value.Name), supplier.Code, supplier.Name, taxCode, taxRate,
            termCode, termsText, due, links.OrderLineIds, links.OrderCodes, links.ReceiptCodes, invoiceNo, series);
    }

    /// <summary>The same invoice number (and series) of a supplier is booked once: only a cancelled invoice frees it.</summary>
    private async Task EnsureNotDuplicateAsync(string supplierCode, string invoiceNo, string? series, long? invoiceId, CancellationToken ct)
    {
        var no = invoiceNo.Trim().ToUpperInvariant();
        var ser = string.IsNullOrWhiteSpace(series) ? null : series.Trim().ToUpperInvariant();
        var clash = await db.PurchaseInvoices.AsNoTracking().Where(x => x.SupplierCode == supplierCode && x.InvoiceNo == no
            && x.Status != "Cancelled" && (invoiceId == null || x.Id != invoiceId)
            && (ser == null ? x.InvoiceSeries == null || x.InvoiceSeries == "" : x.InvoiceSeries == ser)).Select(x => x.Code).FirstOrDefaultAsync(ct);
        if (clash is not null) throw new BusinessRuleException("purchaseInvoice.duplicate", no, supplierCode, clash);
    }

    private sealed record Links(IReadOnlyList<long?> OrderLineIds, string? OrderCodes, string? ReceiptCodes);

    /// <summary>
    /// The lines that bill a goods receipt line: the receipt must be approved or posted, of this unit, supplier and currency; the line
    /// has the same material and unit; and what all invoices bill of a receipt line never passes what was received. The order line such
    /// an item bills is the one its receipt line follows. A line that bills an order line directly: the order is approved, of this
    /// unit, supplier and currency, same material and unit. For every order line billed (either way) the quantity billed by all
    /// invoices never passes the quantity ordered. Lines billing nothing are free. Returns the order line of each item and the numbers
    /// of the orders and receipts the invoice follows (comma separated).
    /// </summary>
    private async Task<Links> ValidateLinksAsync(string unitCode, string supplierCode, string currencyCode, SavePurchaseInvoiceRequest request, long? invoiceId, CancellationToken ct)
    {
        var items = request.Items;
        var receiptLineIds = items.Where(x => x.GoodsReceiptLineId is not null).Select(x => x.GoodsReceiptLineId!.Value).Distinct().ToList();
        var receiptRows = receiptLineIds.Count == 0 ? []
            : await (from l in db.GoodsReceiptLines.AsNoTracking() join r in db.GoodsReceipts.AsNoTracking() on l.ReceiptId equals r.Id
                     where receiptLineIds.Contains(l.Id) select new { Line = l, Receipt = r }).ToDictionaryAsync(x => x.Line.Id, ct);
        var billedReceipt = await PurchaseInvoiceProgress.InvoicedByReceiptLineAsync(db, receiptLineIds, invoiceId, ct);
        var takenReceipt = new Dictionary<long, decimal>();
        var receiptCodes = new SortedSet<string>(StringComparer.Ordinal);
        var effective = new long?[items.Count];
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            var material = item.MaterialCode.Trim().ToUpperInvariant();
            var uom = item.UomCode.Trim().ToUpperInvariant();
            if (item.GoodsReceiptLineId is long receiptLineId)
            {
                if (!receiptRows.TryGetValue(receiptLineId, out var found)) throw new BusinessRuleException("purchaseInvoice.lineNotInReceipt", material);
                var (line, receipt) = (found.Line, found.Receipt);
                if (receipt.UnitCode != unitCode || !BillableReceiptStatuses.Contains(receipt.Status))
                    throw new BusinessRuleException("purchaseInvoice.receiptNotReady", receipt.Code);
                if (receipt.SupplierCode != supplierCode) throw new BusinessRuleException("purchaseInvoice.receiptSupplier", receipt.Code, receipt.SupplierCode ?? "");
                if (receipt.CurrencyCode != currencyCode) throw new BusinessRuleException("purchaseInvoice.receiptCurrency", receipt.Code, receipt.CurrencyCode);
                if (line.Kind != "ITEM" || line.MaterialCode != material || line.UomCode != uom)
                    throw new BusinessRuleException("purchaseInvoice.lineMismatch", material, receipt.Code);
                takenReceipt[receiptLineId] = takenReceipt.GetValueOrDefault(receiptLineId) + item.Quantity;
                var remaining = line.Quantity - billedReceipt.GetValueOrDefault(receiptLineId);
                if (takenReceipt[receiptLineId] > remaining)
                    throw new BusinessRuleException("purchaseInvoice.exceedsReceipt", material, remaining.ToString("0.####"), receipt.Code);
                receiptCodes.Add(receipt.Code);
                effective[i] = line.PurchaseOrderLineId;
            }
            else effective[i] = item.PurchaseOrderLineId;
        }

        var orderLineIds = effective.Where(x => x is not null).Select(x => x!.Value).Distinct().ToList();
        var orderCodes = new SortedSet<string>(StringComparer.Ordinal);
        if (orderLineIds.Count > 0)
        {
            var orderRows = await (from l in db.PurchaseOrderLines.AsNoTracking() join o in db.PurchaseOrders.AsNoTracking() on l.OrderId equals o.Id
                                   where orderLineIds.Contains(l.Id) select new { Line = l, Order = o }).ToDictionaryAsync(x => x.Line.Id, ct);
            var billedOrder = await PurchaseInvoiceProgress.InvoicedByOrderLineAsync(db, orderLineIds, invoiceId, ct);
            var takenOrder = new Dictionary<long, decimal>();
            for (var i = 0; i < items.Count; i++)
            {
                if (effective[i] is not long orderLineId) continue;
                var item = items[i];
                var material = item.MaterialCode.Trim().ToUpperInvariant();
                var uom = item.UomCode.Trim().ToUpperInvariant();
                if (!orderRows.TryGetValue(orderLineId, out var found)) throw new BusinessRuleException("purchaseInvoice.lineNotInOrder", material);
                var (line, order) = (found.Line, found.Order);
                // A line that comes from a receipt keeps the order of the receipt whatever its status; a line typed against an order needs it approved.
                if (item.GoodsReceiptLineId is null && (order.UnitCode != unitCode || order.Status != "Approved"))
                    throw new BusinessRuleException("purchaseInvoice.orderNotApproved", order.Code);
                if (order.SupplierCode != supplierCode) throw new BusinessRuleException("purchaseInvoice.orderSupplier", order.Code, order.SupplierCode);
                if (order.CurrencyCode != currencyCode) throw new BusinessRuleException("purchaseInvoice.orderCurrency", order.Code, order.CurrencyCode);
                if (line.MaterialCode != material || line.UomCode != uom)
                    throw new BusinessRuleException("purchaseInvoice.orderLineMismatch", material, order.Code);
                takenOrder[orderLineId] = takenOrder.GetValueOrDefault(orderLineId) + item.Quantity;
                var remaining = line.Quantity - billedOrder.GetValueOrDefault(orderLineId);
                if (takenOrder[orderLineId] > remaining)
                    throw new BusinessRuleException("purchaseInvoice.exceedsOrder", material, remaining.ToString("0.####"), order.Code);
                orderCodes.Add(order.Code);
            }
        }
        return new Links(effective, orderCodes.Count == 0 ? null : string.Join(",", orderCodes), receiptCodes.Count == 0 ? null : string.Join(",", receiptCodes));
    }

    private static void Apply(PurchaseInvoice row, SavePurchaseInvoiceRequest request, Checked check)
    {
        row.DocumentDate = request.Date;
        row.VoucherType = request.VoucherType.Trim();
        row.SupplierCode = check.SupplierCode;
        row.SupplierName = check.SupplierName;
        row.InvoiceNo = check.InvoiceNo;
        row.InvoiceSeries = check.InvoiceSeries;
        row.InvoiceDate = request.InvoiceDate;
        row.DueDate = check.DueDate;
        row.PaymentTerms = check.PaymentTermsText;
        row.PaymentTermCode = check.PaymentTermCode;
        row.CurrencyCode = request.CurrencyCode.Trim().ToUpperInvariant();
        row.ExchangeRate = check.Rate;
        row.TaxRateCode = check.TaxRateCode;
        row.TaxRate = check.TaxRate;
        row.PurchaseOrderCode = check.OrderCodes;
        row.GoodsReceiptCode = check.ReceiptCodes;
        row.Note = request.Note?.Trim();
        row.ProjectCode = ProjectChecks.Normalize(request.ProjectCode);
        // The amounts of the lines are rounded one by one, as they are saved; the tax is on their total.
        row.SubTotal = request.Items.Sum(x => decimal.Round(x.Quantity * x.UnitPrice, 2));
        row.TaxAmount = decimal.Round(row.SubTotal * check.TaxRate / 100m, 2);
        row.TotalValue = decimal.Round((row.SubTotal + row.TaxAmount) * check.Rate, 2);
    }

    private static List<PurchaseInvoiceLine> Lines(SavePurchaseInvoiceRequest request, long id, Checked check)
    {
        var number = 0;
        return request.Items.Select((item, index) => new PurchaseInvoiceLine
        {
            InvoiceId = id, LineNo = ++number,
            MaterialCode = item.MaterialCode.Trim().ToUpperInvariant(),
            MaterialName = check.Names.GetValueOrDefault(item.MaterialCode.Trim().ToUpperInvariant(), string.Empty),
            UomCode = item.UomCode.Trim().ToUpperInvariant(), Quantity = item.Quantity, UnitPrice = item.UnitPrice,
            Amount = decimal.Round(item.Quantity * item.UnitPrice, 2), Note = item.Note?.Trim(),
            PurchaseOrderLineId = check.OrderLineIds[index], GoodsReceiptLineId = item.GoodsReceiptLineId
        }).ToList();
    }

    private static SavePurchaseInvoiceLine KeepPrice(SavePurchaseInvoiceLine item, IEnumerable<PurchaseInvoiceLine> savedLines, int index)
    {
        var saved = savedLines.OrderBy(x => x.LineNo).ElementAtOrDefault(index);
        var same = saved is not null && string.Equals(saved.MaterialCode, item.MaterialCode?.Trim(), StringComparison.OrdinalIgnoreCase);
        return item with { UnitPrice = same ? saved!.UnitPrice : 0 };
    }

    private static string LineSummary(IEnumerable<PurchaseInvoiceLine> lines) =>
        string.Join("; ", lines.OrderBy(x => x.LineNo).Select(x => $"{x.MaterialCode} {x.Quantity} {x.UomCode} x {x.UnitPrice}"));

    private async Task<IReadOnlyList<PurchaseInvoiceDto>> ToDtosAsync(List<PurchaseInvoice> rows, bool canSeePrice, CancellationToken ct)
    {
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var ids = rows.SelectMany(x => new int?[] { x.CreatedBy, x.ApprovedByUserId }).Where(x => x.HasValue)
            .Select(x => x!.Value).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        // The number of the order and the receipt each line bills, shown on the line.
        var orderLineIds = rows.SelectMany(x => x.Lines).Where(l => l.PurchaseOrderLineId != null).Select(l => l.PurchaseOrderLineId!.Value).Distinct().ToList();
        var orderCodes = orderLineIds.Count == 0 ? new Dictionary<long, string>()
            : await (from ol in db.PurchaseOrderLines.AsNoTracking() join o in db.PurchaseOrders.AsNoTracking() on ol.OrderId equals o.Id
                     where orderLineIds.Contains(ol.Id) select new { ol.Id, o.Code }).ToDictionaryAsync(x => x.Id, x => x.Code, ct);
        var receiptLineIds = rows.SelectMany(x => x.Lines).Where(l => l.GoodsReceiptLineId != null).Select(l => l.GoodsReceiptLineId!.Value).Distinct().ToList();
        var receiptCodes = receiptLineIds.Count == 0 ? new Dictionary<long, string>()
            : await (from rl in db.GoodsReceiptLines.AsNoTracking() join r in db.GoodsReceipts.AsNoTracking() on rl.ReceiptId equals r.Id
                     where receiptLineIds.Contains(rl.Id) select new { rl.Id, r.Code }).ToDictionaryAsync(x => x.Id, x => x.Code, ct);
        return rows.Select(row => new PurchaseInvoiceDto(row.Id, row.Code, row.DocumentDate, row.CreatedDate, row.UnitCode,
            units.GetValueOrDefault(row.UnitCode, row.UnitCode), row.VoucherType, row.SupplierCode, row.SupplierName, row.InvoiceNo,
            row.InvoiceSeries, row.InvoiceDate, row.DueDate, row.PaymentTerms, row.CurrencyCode, row.ExchangeRate, row.TaxRateCode, row.TaxRate,
            canSeePrice ? row.SubTotal : 0, canSeePrice ? row.TaxAmount : 0, row.Note, row.Status, canSeePrice ? row.TotalValue : 0,
            row.PurchaseOrderCode, row.GoodsReceiptCode, users.GetValueOrDefault(row.CreatedBy ?? 0, ""),
            row.ApprovedByUserId is int approved ? users.GetValueOrDefault(approved) : null,
            row.Lines.OrderBy(x => x.LineNo).Select(line => new PurchaseInvoiceLineDto(line.Id, line.MaterialCode, line.MaterialName,
                line.UomCode, line.Quantity, canSeePrice ? line.UnitPrice : 0, canSeePrice ? line.Amount : 0, line.Note,
                line.PurchaseOrderLineId, line.PurchaseOrderLineId is long ol ? orderCodes.GetValueOrDefault(ol) : null,
                line.GoodsReceiptLineId, line.GoodsReceiptLineId is long rl ? receiptCodes.GetValueOrDefault(rl) : null)).ToList(),
            row.Version, ProjectCode: row.ProjectCode, PaymentTermCode: row.PaymentTermCode)).ToList();
    }
}
