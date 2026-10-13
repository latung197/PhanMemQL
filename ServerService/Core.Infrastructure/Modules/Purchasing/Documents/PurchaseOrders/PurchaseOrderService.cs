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
using Core.Application.Modules.Purchasing.Documents.PurchaseOrders;
using Core.Application.Modules.Users;
using Core.Application.Modules.VoucherStatuses;
using Core.Application.Modules.VoucherNumbering;
using Core.Domain.Modules.Purchasing.Documents.PurchaseOrders;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Modules.Inventory;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Modules.Purchasing.Documents.PurchaseRequests;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Purchasing.Documents.PurchaseOrders;

/// <summary>
/// What the goods receipts have already received of the lines of orders: the sum of the quantities of the receipt lines that point to
/// an order line (<c>purchase_order_line_id</c>), on receipts that are not cancelled. Nothing is stored on the order: deleting or
/// cancelling a receipt gives its quantity back.
/// </summary>
public static class PurchaseOrderProgress
{
    public static async Task<Dictionary<long, decimal>> ReceivedByLineAsync(CoreContext db, IReadOnlyCollection<long> orderLineIds,
        long? exceptReceiptId, CancellationToken ct)
    {
        if (orderLineIds.Count == 0) return [];
        var rows = await (from line in db.GoodsReceiptLines.AsNoTracking()
                          join receipt in db.GoodsReceipts.AsNoTracking() on line.ReceiptId equals receipt.Id
                          where line.PurchaseOrderLineId != null && orderLineIds.Contains(line.PurchaseOrderLineId.Value)
                                && line.Kind == "ITEM" && receipt.Status != "Cancelled" && (exceptReceiptId == null || receipt.Id != exceptReceiptId)
                          select new { LineId = line.PurchaseOrderLineId!.Value, line.Quantity }).ToListAsync(ct);
        return rows.GroupBy(x => x.LineId).ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));
    }

    /// <summary>True when a receipt that is not cancelled still receives a line of the order.</summary>
    public static Task<bool> HasReceiptsAsync(CoreContext db, long orderId, CancellationToken ct) =>
        (from line in db.GoodsReceiptLines.AsNoTracking()
         join receipt in db.GoodsReceipts.AsNoTracking() on line.ReceiptId equals receipt.Id
         join ol in db.PurchaseOrderLines.AsNoTracking() on line.PurchaseOrderLineId equals (long?)ol.Id
         where ol.OrderId == orderId && receipt.Status != "Cancelled"
         select line.Id).AnyAsync(ct);
}

/// <summary>
/// Đơn mua hàng. Same layout, statuses, approval and "save at a status" flow as the purchase request, and nothing is posted to a
/// ledger: an order only says what is bought from a supplier; goods receipts carry it out (part by part). The lines may carry out
/// the lines of approved purchase requests; the tax is one rate for the whole order.
/// </summary>
public sealed class PurchaseOrderService(CoreContext db, IUnitOfWork unitOfWork, IVoucherNumberService numbers,
    IFiscalPeriodService fiscal, IExchangeRateService rates, IPermissionService permissions,
    IDocumentApprovalService approvals, IAuditLog audit, IVoucherStatusService statuses, IExcelExporter excel) : IPurchaseOrderService
{
    private const string Function = "pur_order";

    public async Task<PurchaseOrderOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct) => new(
        await db.UsableBy(unitCode).AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new PurchaseOrderOption(x.Code, x.Name)).ToListAsync(ct),
        await db.Currencies.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new PurchaseOrderOption(x.Code, x.Name)).ToListAsync(ct),
        await db.Suppliers.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new PurchaseOrderOption(x.Code, x.Name)).ToListAsync(ct),
        await db.TaxRates.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new PurchaseOrderTaxOption(x.Code, x.Name, x.IsExempt ? 0 : x.Rate)).ToListAsync(ct));

    private static readonly SortMap<PurchaseOrder> SortColumns = SortMap<PurchaseOrder>.By(x => x.Id, "date", defaultDescending: true)
        .Add("date", x => x.DocumentDate).Add("code", x => x.Code).Add("warehouse", x => x.WarehouseCode)
        .Add("voucherType", x => x.VoucherType).Add("supplier", x => x.SupplierName).Add("status", x => x.Status)
        .Add("totalValue", x => x.TotalValue).Add("deliveryDate", x => x.DeliveryDate).AddRecordStamps();

    /// <summary>The vouchers of the unit the user may see that the query's filters leave.</summary>
    private async Task<IQueryable<PurchaseOrder>> FilterAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var rows = db.PurchaseOrders.AsNoTracking().Where(x => x.UnitCode == unitCode);
        if (!await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewAll, ct)) rows = rows.Where(x => x.CreatedBy == userId);
        if (query.StatusFilter is { } status) { var text = status.ToString(); rows = rows.Where(x => x.Status == text); }
        if (!string.IsNullOrWhiteSpace(query.Warehouse)) { var wh = query.Warehouse.Trim().ToUpperInvariant(); rows = rows.Where(x => x.WarehouseCode == wh); }
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
                || SearchFunctions.Matches(x.PaymentTerms, pattern) || SearchFunctions.Matches(x.PurchaseRequestCode, pattern)
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

    public async Task<PagedResult<PurchaseOrderDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        EnsureSortAllowed(query, canSeePrice);
        var rows = await FilterAsync(userId, unitCode, query, ct);
        // The page is cut on the headers; the items of those few vouchers are read afterwards.
        var page = await rows.ToPagedAsync(query, SortColumns, ct);
        var ids = page.Items.Select(x => x.Id).ToList();
        var lines = await db.PurchaseOrderLines.AsNoTracking().Where(x => ids.Contains(x.OrderId)).ToListAsync(ct);
        foreach (var row in page.Items) row.Lines = lines.Where(x => x.OrderId == row.Id).ToList();
        return new PagedResult<PurchaseOrderDto>(await ToDtosAsync(page.Items.ToList(), canSeePrice, ct), page.Total, page.Page, page.PageSize);
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
        var names = (await statuses.GetNamesAsync(unitCode, ct)).GetValueOrDefault("DMH");
        string StatusName(string status) => names?.GetValueOrDefault(status)?.Name ?? status;
        var columns = new List<ExportColumn<PurchaseOrder>>
        {
            new("export.purchaseOrder.code", x => x.Code), new("export.purchaseOrder.date", x => x.DocumentDate),
            new("export.purchaseOrder.unit", x => units.GetValueOrDefault(x.UnitCode, x.UnitCode)),
            new("export.purchaseOrder.supplier", x => x.SupplierName),
            new("export.purchaseOrder.warehouse", x => warehouses.GetValueOrDefault(x.WarehouseCode, x.WarehouseCode)),
            new("export.purchaseOrder.voucherType", x => x.VoucherType),
            new("export.purchaseOrder.deliveryDate", x => x.DeliveryDate),
            new("export.purchaseOrder.paymentTerms", x => x.PaymentTerms),
            new("export.purchaseOrder.status", x => StatusName(x.Status))
        };
        if (canSeePrice)
        {
            columns.Add(new("export.purchaseOrder.subTotal", x => x.SubTotal));
            columns.Add(new("export.purchaseOrder.taxAmount", x => x.TaxAmount));
            columns.Add(new("export.purchaseOrder.totalValue", x => x.TotalValue));
        }
        var content = excel.Write("export.purchaseOrder.sheet", columns, list);
        // RecordAsync only adds the row to the context: it is written by this SaveChanges.
        await audit.RecordAsync(new AuditEntry(Function, "purchaseOrder", "export", null, AuditActions.Export, [],
            $"{total} rows; search={query.Search}; status={query.Status}; warehouse={query.Warehouse}; supplier={query.Supplier}; type={query.VoucherType}; code={query.Code}; from={query.From}; to={query.To}"), ct);
        await db.SaveChangesAsync(ct);
        return new ExportFile(content, $"DonMuaHang_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    public async Task<PurchaseOrderDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        await EnsureActionAsync(userId, row, DocumentAction.View, ct);
        return (await ToDtosAsync([row], await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct), ct))[0];
    }

    public async Task<IReadOnlyList<OpenPurchaseOrderDto>> GetOpenAsync(int userId, string unitCode, long? exceptReceiptId, CancellationToken ct)
    {
        var canSeePrice = await permissions.HasRightAsync(userId, "inv_receipt", SpecialRightCatalog.ViewPrice, ct);
        var rows = await db.PurchaseOrders.AsNoTracking().Include(x => x.Lines)
            .Where(x => x.UnitCode == unitCode && x.Status == "Approved")
            .OrderByDescending(x => x.DocumentDate).ThenByDescending(x => x.Id).ToListAsync(ct);
        var received = await PurchaseOrderProgress.ReceivedByLineAsync(db, rows.SelectMany(x => x.Lines).Select(x => x.Id).ToList(), exceptReceiptId, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var result = new List<OpenPurchaseOrderDto>();
        foreach (var row in rows)
        {
            var lines = row.Lines.OrderBy(x => x.LineNo).Select(x =>
            {
                var done = received.GetValueOrDefault(x.Id);
                return new OpenPurchaseOrderLineDto(x.Id, x.MaterialCode, x.MaterialName, x.UomCode, x.Quantity, done,
                    x.Quantity - done, canSeePrice ? x.UnitPrice : 0, x.Note, x.DeliveryDate ?? row.DeliveryDate);
            }).Where(x => x.RemainingQuantity > 0).ToList();
            if (lines.Count == 0) continue;
            result.Add(new OpenPurchaseOrderDto(row.Id, row.Code, row.DocumentDate, row.DeliveryDate, row.WarehouseCode,
                warehouses.GetValueOrDefault(row.WarehouseCode, row.WarehouseCode), row.VoucherType, row.SupplierCode, row.SupplierName,
                row.PaymentTerms, row.CurrencyCode, row.ExchangeRate, row.Note, lines, row.ProjectCode));
        }
        return result;
    }

    public async Task<PurchaseOrderDto> CreateAsync(int userId, string unitCode, SavePurchaseOrderRequest request, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, Core.Domain.Modules.Users.PermissionAction.Create, ct);
        var check = await ValidateAsync(unitCode, request, null, ct);
        await ProjectChecks.EnsureAsync(db, request.ProjectCode, null, ct);
        var target = Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, unitCode, isOwner: true, target, ct);
        var id = await unitOfWork.ExecuteAsync(async token =>
        {
            var row = new PurchaseOrder
            {
                UnitCode = unitCode, DocumentDate = request.Date, CreatedDate = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            Apply(row, request, check);
            row.Code = await numbers.NextAsync("DMH", unitCode, request.Date, token);
            db.PurchaseOrders.Add(row);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, row.Id, check.Names));
            audit.Attach(row, [new AuditChange("items", null, LineSummary(row.Lines))]);
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
            return row.Id;
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<PurchaseOrderDto> UpdateAsync(int userId, string unitCode, long id,
        SavePurchaseOrderRequest request, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Edit, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("purchaseOrder.editDraftOnly");
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
            db.PurchaseOrderLines.RemoveRange(row.Lines);
            row.Lines.Clear();
            audit.Attach(row, [new AuditChange("items", before, LineSummary(Lines(request, id, check.Names)))]);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, id, check.Names));
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<PurchaseOrderDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct)
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
        // An order is never posted: only submit, approve and cancel.
        var policyAction = normalized switch
        {
            "submit" => DocumentAction.Submit, "approve" => DocumentAction.Approve,
            "cancel" => DocumentAction.Cancel, _ => throw new BusinessRuleException("purchaseOrder.invalidAction")
        };
        if (normalized == "cancel" && row.Status == "Pending")
            throw new BusinessRuleException("purchaseOrder.withdrawBeforeCancel");
        await EnsureActionAsync(userId, row, policyAction, ct);
        if (normalized == "cancel" && await PurchaseOrderProgress.HasReceiptsAsync(db, row.Id, ct))
            throw new BusinessRuleException("purchaseOrder.cancelHasReceipts");
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
            else row.Status = "Cancelled";
            await db.SaveChangesAsync(token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    /// <summary>The status to save at: Draft, Pending or Approved (an order has no Posted status).</summary>
    private static DocumentStatus Parse(string? value)
    {
        var target = VoucherTargetStatus.Parse(value);
        if (target == DocumentStatus.Posted) throw new BusinessRuleException("purchaseOrder.noPosting");
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
    private async Task AdvanceAsync(PurchaseOrder row, string unitCode, int userId, DocumentStatus target, CancellationToken token)
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

    public async Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Cancel, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("purchaseOrder.deleteDraftOnly");
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            db.PurchaseOrderLines.RemoveRange(row.Lines);
            db.PurchaseOrders.Remove(row);
            await db.SaveChangesAsync(token);
        }, ct);
    }

    public async Task<PurchaseOrderDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct)
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

    private async Task<PurchaseOrder> FindAsync(long id, string unitCode, CancellationToken ct, bool tracking = false)
    {
        var query = db.PurchaseOrders.Include(x => x.Lines).Where(x => x.Id == id && x.UnitCode == unitCode);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct) ?? throw new NotFoundException("purchaseOrder.notFound");
    }

    private async Task<PurchaseOrderDto> ResultAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        return (await ToDtosAsync([row], canSeePrice, ct))[0];
    }

    private async Task EnsureActionAsync(int userId, PurchaseOrder row, DocumentAction action, CancellationToken ct)
    {
        var actor = DocumentActor.For(await permissions.GetEffectiveAsync(userId, ct),
            await permissions.GetRightsAsync(userId, ct), Function, row.CreatedBy == userId, row.UnitCode);
        var decision = DocumentStatusPolicy.Check(action, Enum.Parse<DocumentStatus>(row.Status), actor);
        if (!decision.Allowed) throw new ForbiddenException(decision.Reason ?? "permission.denied");
        if (action == DocumentAction.Submit) await statuses.EnsureEnabledAsync(row.UnitCode, Function, DocumentStatus.Pending, ct);
    }

    /// <summary>What a save found out while checking the order: the rate, the material names, the supplier, the tax and the requests it follows.</summary>
    private sealed record Checked(decimal Rate, IReadOnlyDictionary<string, string> Names, string SupplierCode, string SupplierName,
        string? TaxRateCode, decimal TaxRate, string? RequestCodes, string? PaymentTermCode, string? PaymentTermsText);

    private async Task<Checked> ValidateAsync(string unitCode, SavePurchaseOrderRequest request, long? orderId, CancellationToken ct)
    {
        await fiscal.EnsureDateOpenAsync(unitCode, request.Date, ct);
        var warehouseCode = Guard.Code(request.WarehouseCode, 20, "field.warehouseCode");
        if (!await db.Warehouses.AnyAsync(x => x.Code == warehouseCode && x.IsActive, ct))
            throw new BusinessRuleException("purchaseOrder.warehouseInvalid");
        // The unit of the order must be one of the units the warehouse is for (shared warehouses suit every unit).
        if (!await db.UsableBy(unitCode).AnyAsync(x => x.Code == warehouseCode, ct))
            throw new BusinessRuleException("purchaseOrder.warehouseNotForUnit", warehouseCode, unitCode);
        var currencyCode = Guard.Code(request.CurrencyCode, 10, "field.currencyCode");
        if (!await db.Currencies.AnyAsync(x => x.Code == currencyCode && x.IsActive, ct))
            throw new BusinessRuleException("purchaseOrder.currencyInvalid");
        var rate = await rates.GetRateAsync(currencyCode, request.Date, ct);
        if (request.Items is null || request.Items.Count == 0) throw new BusinessRuleException("purchaseOrder.itemsRequired");
        if (request.Items.Count > 500) throw new BusinessRuleException("purchaseOrder.tooManyLines");
        _ = Guard.Required(request.VoucherType, 100, "field.purchaseOrderType");
        _ = Guard.Optional(request.PaymentTerms, 200, "field.paymentTerms");
        _ = Guard.Optional(request.Note, 1000, "field.note");
        if (request.DeliveryDate is { } due && due < request.Date) throw new BusinessRuleException("purchaseOrder.deliveryDateInvalid");
        var supplierCode = Guard.Code(request.SupplierCode, 20, "field.supplierCode");
        var supplier = await db.Suppliers.AsNoTracking().FirstOrDefaultAsync(x => x.Code == supplierCode, ct);
        if (supplier is null || !supplier.IsActive) throw new BusinessRuleException("purchaseOrder.supplierInvalid", supplierCode);
        // A payment term of the catalog gives its name to the order; without one the free text stays.
        string? termCode = null;
        var termsText = request.PaymentTerms?.Trim();
        if (!string.IsNullOrWhiteSpace(request.PaymentTermCode))
        {
            termCode = request.PaymentTermCode.Trim().ToUpperInvariant();
            var term = await db.PaymentTerms.AsNoTracking().FirstOrDefaultAsync(x => x.Code == termCode, ct);
            if (term is null || !term.IsActive) throw new BusinessRuleException("paymentTerm.invalid", termCode);
            termsText = term.Name;
        }
        string? taxCode = null;
        decimal taxRate = 0;
        if (!string.IsNullOrWhiteSpace(request.TaxRateCode))
        {
            taxCode = request.TaxRateCode.Trim().ToUpperInvariant();
            var tax = await db.TaxRates.AsNoTracking().FirstOrDefaultAsync(x => x.Code == taxCode, ct);
            if (tax is null || !tax.IsActive) throw new BusinessRuleException("purchaseOrder.taxInvalid", taxCode);
            taxRate = tax.IsExempt ? 0 : tax.Rate;
        }
        foreach (var item in request.Items)
        {
            _ = Guard.Code(item.MaterialCode, 50, "field.materialCode");
            _ = Guard.Code(item.UomCode, 20, "field.uomCode");
            _ = Guard.Optional(item.Note, 300, "field.note");
            if (item.Quantity <= 0 || item.UnitPrice < 0) throw new BusinessRuleException("purchaseOrder.lineInvalid");
            if (item.DeliveryDate is { } lineDue && lineDue < request.Date) throw new BusinessRuleException("purchaseOrder.lineDeliveryDateInvalid");
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
        }
        var requestCodes = await ValidateRequestLinkAsync(unitCode, warehouseCode, request, orderId, ct);
        return new Checked(rate, materials.ToDictionary(x => x.Key, x => x.Value.Name), supplier.Code, supplier.Name, taxCode, taxRate, requestCodes, termCode, termsText);
    }

    /// <summary>
    /// A line that carries out a purchase request line: the request must be approved, of this unit and warehouse; the line has the same
    /// material and unit; and the quantities ordered from a request line (by this order and by the others that are not cancelled) never
    /// pass what was asked. Lines bought without a request are free. Returns the numbers of the requests the lines follow (comma separated).
    /// </summary>
    private async Task<string?> ValidateRequestLinkAsync(string unitCode, string warehouseCode, SavePurchaseOrderRequest request, long? orderId, CancellationToken ct)
    {
        var lineIds = request.Items.Where(x => x.PurchaseRequestLineId is not null).Select(x => x.PurchaseRequestLineId!.Value).Distinct().ToList();
        if (lineIds.Count == 0) return null;
        var requests = await db.PurchaseRequests.AsNoTracking().Include(x => x.Lines)
            .Where(x => x.UnitCode == unitCode && x.Lines.Any(l => lineIds.Contains(l.Id))).ToListAsync(ct);
        var owner = new Dictionary<long, (Core.Domain.Modules.Purchasing.Documents.PurchaseRequests.PurchaseRequest Request,
            Core.Domain.Modules.Purchasing.Documents.PurchaseRequests.PurchaseRequestLine Line)>();
        foreach (var r in requests)
        {
            if (r.Status != "Approved") throw new BusinessRuleException("purchaseOrder.requestNotApproved", r.Code);
            if (r.WarehouseCode != warehouseCode) throw new BusinessRuleException("purchaseOrder.requestWarehouse", r.Code, r.WarehouseCode);
            foreach (var l in r.Lines) owner[l.Id] = (r, l);
        }
        var ordered = await PurchaseRequestProgress.OrderedByLineAsync(db, owner.Keys.ToList(), orderId, ct);
        var taken = new Dictionary<long, decimal>();
        foreach (var item in request.Items.Where(x => x.PurchaseRequestLineId is not null))
        {
            var material = item.MaterialCode.Trim().ToUpperInvariant();
            if (item.PurchaseRequestLineId is not long lineId || !owner.TryGetValue(lineId, out var found))
                throw new BusinessRuleException("purchaseOrder.lineNotInRequest", material);
            var (req, line) = found;
            if (line.MaterialCode != material || line.UomCode != item.UomCode.Trim().ToUpperInvariant())
                throw new BusinessRuleException("purchaseOrder.requestLineMismatch", material, req.Code);
            taken[lineId] = taken.GetValueOrDefault(lineId) + item.Quantity;
            var remaining = line.Quantity - ordered.GetValueOrDefault(lineId);
            if (taken[lineId] > remaining) throw new BusinessRuleException("purchaseOrder.exceedsRequest", material, remaining.ToString("0.####"), req.Code);
        }
        return string.Join(",", requests.Select(x => x.Code).Order(StringComparer.Ordinal));
    }

    private static void Apply(PurchaseOrder row, SavePurchaseOrderRequest request, Checked check)
    {
        row.DocumentDate = request.Date;
        row.DeliveryDate = request.DeliveryDate;
        row.WarehouseCode = request.WarehouseCode.Trim().ToUpperInvariant();
        row.VoucherType = request.VoucherType.Trim();
        row.SupplierCode = check.SupplierCode;
        row.SupplierName = check.SupplierName;
        row.PaymentTerms = check.PaymentTermsText;
        row.PaymentTermCode = check.PaymentTermCode;
        row.CurrencyCode = request.CurrencyCode.Trim().ToUpperInvariant();
        row.ExchangeRate = check.Rate;
        row.TaxRateCode = check.TaxRateCode;
        row.TaxRate = check.TaxRate;
        row.PurchaseRequestCode = check.RequestCodes;
        row.Note = request.Note?.Trim();
        row.ProjectCode = ProjectChecks.Normalize(request.ProjectCode);
        // The amounts of the lines are rounded one by one, as they are saved; the tax is on their total.
        row.SubTotal = request.Items.Sum(x => decimal.Round(x.Quantity * x.UnitPrice, 2));
        row.TaxAmount = decimal.Round(row.SubTotal * check.TaxRate / 100m, 2);
        row.TotalValue = decimal.Round((row.SubTotal + row.TaxAmount) * check.Rate, 2);
    }

    private static List<PurchaseOrderLine> Lines(SavePurchaseOrderRequest request, long id, IReadOnlyDictionary<string, string> names)
    {
        var number = 0;
        return request.Items.Select(item => new PurchaseOrderLine
        {
            OrderId = id, LineNo = ++number,
            MaterialCode = item.MaterialCode.Trim().ToUpperInvariant(),
            MaterialName = names.GetValueOrDefault(item.MaterialCode.Trim().ToUpperInvariant(), string.Empty),
            UomCode = item.UomCode.Trim().ToUpperInvariant(), Quantity = item.Quantity, UnitPrice = item.UnitPrice,
            Amount = decimal.Round(item.Quantity * item.UnitPrice, 2), Note = item.Note?.Trim(),
            PurchaseRequestLineId = item.PurchaseRequestLineId,
            DeliveryDate = item.DeliveryDate ?? request.DeliveryDate
        }).ToList();
    }

    private static SavePurchaseOrderLine KeepPrice(SavePurchaseOrderLine item, IEnumerable<PurchaseOrderLine> savedLines, int index)
    {
        var saved = savedLines.OrderBy(x => x.LineNo).ElementAtOrDefault(index);
        var same = saved is not null && string.Equals(saved.MaterialCode, item.MaterialCode?.Trim(), StringComparison.OrdinalIgnoreCase);
        return item with { UnitPrice = same ? saved!.UnitPrice : 0 };
    }

    private static string LineSummary(IEnumerable<PurchaseOrderLine> lines) =>
        string.Join("; ", lines.OrderBy(x => x.LineNo).Select(x => $"{x.MaterialCode} {x.Quantity} {x.UomCode} x {x.UnitPrice}"));

    private async Task<IReadOnlyList<PurchaseOrderDto>> ToDtosAsync(List<PurchaseOrder> rows, bool canSeePrice, CancellationToken ct)
    {
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var ids = rows.SelectMany(x => new int?[] { x.CreatedBy, x.ApprovedByUserId }).Where(x => x.HasValue)
            .Select(x => x!.Value).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        var received = await PurchaseOrderProgress.ReceivedByLineAsync(db, rows.SelectMany(x => x.Lines).Select(x => x.Id).ToList(), null, ct);
        // The number of the purchase request each line carries out, shown on the line.
        var requestLineIds = rows.SelectMany(x => x.Lines).Where(l => l.PurchaseRequestLineId != null)
            .Select(l => l.PurchaseRequestLineId!.Value).Distinct().ToList();
        var requestCodes = requestLineIds.Count == 0 ? new Dictionary<long, string>()
            : await (from rl in db.PurchaseRequestLines.AsNoTracking() join r in db.PurchaseRequests.AsNoTracking() on rl.RequestId equals r.Id
                     where requestLineIds.Contains(rl.Id) select new { rl.Id, r.Code }).ToDictionaryAsync(x => x.Id, x => x.Code, ct);
        return rows.Select(row => new PurchaseOrderDto(row.Id, row.Code, row.DocumentDate, row.CreatedDate, row.DeliveryDate,
            row.UnitCode, units.GetValueOrDefault(row.UnitCode, row.UnitCode),
            row.WarehouseCode, warehouses.GetValueOrDefault(row.WarehouseCode, row.WarehouseCode), row.VoucherType,
            row.SupplierCode, row.SupplierName, row.PaymentTerms, row.CurrencyCode, row.ExchangeRate,
            row.TaxRateCode, row.TaxRate, canSeePrice ? row.SubTotal : 0, canSeePrice ? row.TaxAmount : 0, row.Note, row.Status,
            canSeePrice ? row.TotalValue : 0, row.PurchaseRequestCode, users.GetValueOrDefault(row.CreatedBy ?? 0, ""),
            row.ApprovedByUserId is int approved ? users.GetValueOrDefault(approved) : null,
            row.Lines.OrderBy(x => x.LineNo).Select(line => new PurchaseOrderLineDto(line.Id, line.MaterialCode, line.MaterialName,
                line.UomCode, line.Quantity, canSeePrice ? line.UnitPrice : 0, canSeePrice ? line.Amount : 0, line.Note,
                received.GetValueOrDefault(line.Id), line.PurchaseRequestLineId,
                line.PurchaseRequestLineId is long requestLineId ? requestCodes.GetValueOrDefault(requestLineId) : null,
                line.DeliveryDate ?? row.DeliveryDate)).ToList(), row.Version, ProjectCode: row.ProjectCode, PaymentTermCode: row.PaymentTermCode)).ToList();
    }
}
