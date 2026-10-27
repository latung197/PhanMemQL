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
using Core.Application.Modules.Sales.Documents.SalesOrders;
using Core.Application.Modules.Users;
using Core.Application.Modules.VoucherStatuses;
using Core.Application.Modules.VoucherNumbering;
using Core.Domain.Modules.Sales.Documents.SalesOrders;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Modules.Inventory;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Sales.Documents.SalesOrders;

/// <summary>
/// What goods issues have already issued of the lines of orders: the sum of the quantities of the issue lines that point to an order
/// line (<c>sales_order_line_id</c>), on issues that are not cancelled. Nothing is stored on the order: deleting or cancelling an issue
/// gives its quantity back.
/// </summary>
public static class SalesOrderProgress
{
    public static async Task<Dictionary<long, decimal>> IssuedByLineAsync(CoreContext db, IReadOnlyCollection<long> orderLineIds,
        long? exceptIssueId, CancellationToken ct)
    {
        if (orderLineIds.Count == 0) return [];
        var rows = await (from line in db.GoodsIssueLines.AsNoTracking()
                          join issue in db.GoodsIssues.AsNoTracking() on line.IssueId equals issue.Id
                          where line.SalesOrderLineId != null && orderLineIds.Contains(line.SalesOrderLineId.Value)
                                && line.Kind == "ITEM" && issue.Status != "Cancelled" && (exceptIssueId == null || issue.Id != exceptIssueId)
                          select new { LineId = line.SalesOrderLineId!.Value, line.Quantity }).ToListAsync(ct);
        return rows.GroupBy(x => x.LineId).ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));
    }

    /// <summary>True when an issue that is not cancelled still delivers a line of the order.</summary>
    public static Task<bool> HasIssuesAsync(CoreContext db, long orderId, CancellationToken ct) =>
        (from line in db.GoodsIssueLines.AsNoTracking()
         join issue in db.GoodsIssues.AsNoTracking() on line.IssueId equals issue.Id
         join ol in db.SalesOrderLines.AsNoTracking() on line.SalesOrderLineId equals (long?)ol.Id
         where ol.OrderId == orderId && issue.Status != "Cancelled"
         select line.Id).AnyAsync(ct);
}

/// <summary>
/// Đơn bán hàng. Same layout, statuses, approval and "save at a status" flow as the purchase order, and nothing is posted to a ledger:
/// an order only says what is sold to a customer; goods issues carry it out (part by part). The tax is one rate for the whole order.
/// </summary>
public sealed class SalesOrderService(CoreContext db, IUnitOfWork unitOfWork, IVoucherNumberService numbers,
    IFiscalPeriodService fiscal, IExchangeRateService rates, IPermissionService permissions,
    IDocumentApprovalService approvals, IAuditLog audit, IVoucherStatusService statuses, IExcelExporter excel) : ISalesOrderService
{
    private const string Function = "sales_orders";

    public async Task<SalesOrderOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct) => new(
        await db.UsableBy(unitCode).AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new SalesOrderOption(x.Code, x.Name)).ToListAsync(ct),
        await db.Currencies.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new SalesOrderOption(x.Code, x.Name)).ToListAsync(ct),
        await db.TaxRates.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new SalesOrderTaxOption(x.Code, x.Name, x.IsExempt ? 0 : x.Rate)).ToListAsync(ct));

    private static readonly SortMap<SalesOrder> SortColumns = SortMap<SalesOrder>.By(x => x.Id, "date", defaultDescending: true)
        .Add("date", x => x.DocumentDate).Add("code", x => x.Code).Add("warehouse", x => x.WarehouseCode)
        .Add("voucherType", x => x.VoucherType).Add("customer", x => x.CustomerName).Add("status", x => x.Status)
        .Add("totalValue", x => x.TotalValue).Add("deliveryDate", x => x.DeliveryDate).AddRecordStamps();

    /// <summary>The vouchers of the unit the user may see that the filters of the query leave.</summary>
    private async Task<IQueryable<SalesOrder>> FilterAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var rows = db.SalesOrders.AsNoTracking().Where(x => x.UnitCode == unitCode);
        if (!await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewAll, ct)) rows = rows.Where(x => x.CreatedBy == userId);
        if (query.StatusFilter is { } status) { var text = status.ToString(); rows = rows.Where(x => x.Status == text); }
        if (!string.IsNullOrWhiteSpace(query.Warehouse)) { var wh = query.Warehouse.Trim().ToUpperInvariant(); rows = rows.Where(x => x.WarehouseCode == wh); }
        if (!string.IsNullOrWhiteSpace(query.Project)) { var pj = query.Project.Trim().ToUpperInvariant(); rows = rows.Where(x => x.ProjectCode == pj); }
        if (!string.IsNullOrWhiteSpace(query.VoucherType)) { var type = query.VoucherType.Trim(); rows = rows.Where(x => x.VoucherType == type); }
        if (!string.IsNullOrWhiteSpace(query.Customer)) { var customer = query.Customer.Trim().ToUpperInvariant(); rows = rows.Where(x => x.CustomerCode == customer); }
        if (query.From is { } from) rows = rows.Where(x => x.DocumentDate >= from);
        if (query.To is { } to) rows = rows.Where(x => x.DocumentDate <= to);
        var codes = query.CodeParts;
        if (codes.Count == 1) { var pattern = PagingExtensions.ContainsPattern(codes[0]); rows = rows.Where(x => SearchFunctions.Matches(x.Code, pattern)); }
        else if (codes.Count > 1) rows = rows.Where(x => codes.Contains(x.Code));
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = PagingExtensions.ContainsPattern(query.Search);
            rows = rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Note, pattern)
                || SearchFunctions.Matches(x.CustomerName, pattern) || SearchFunctions.Matches(x.CustomerCode, pattern)
                || SearchFunctions.Matches(x.DeliveryAddress, pattern) || SearchFunctions.Matches(x.WarehouseCode, pattern)
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

    public async Task<PagedResult<SalesOrderDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        EnsureSortAllowed(query, canSeePrice);
        var rows = await FilterAsync(userId, unitCode, query, ct);
        // The page is cut on the headers; the items of those few vouchers are read afterwards.
        var page = await rows.ToPagedAsync(query, SortColumns, ct);
        var ids = page.Items.Select(x => x.Id).ToList();
        var lines = await db.SalesOrderLines.AsNoTracking().Where(x => ids.Contains(x.OrderId)).ToListAsync(ct);
        foreach (var row in page.Items) row.Lines = lines.Where(x => x.OrderId == row.Id).ToList();
        return new PagedResult<SalesOrderDto>(await ToDtosAsync(page.Items.ToList(), canSeePrice, ct), page.Total, page.Page, page.PageSize);
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
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var names = (await statuses.GetNamesAsync(unitCode, ct)).GetValueOrDefault("SO");
        string StatusName(string status) => names?.GetValueOrDefault(status)?.Name ?? status;
        var columns = new List<ExportColumn<SalesOrder>>
        {
            new("export.salesOrder.code", x => x.Code), new("export.salesOrder.date", x => x.DocumentDate),
            new("export.salesOrder.unit", x => units.GetValueOrDefault(x.UnitCode, x.UnitCode)),
            new("export.salesOrder.customer", x => x.CustomerName),
            new("export.salesOrder.warehouse", x => warehouses.GetValueOrDefault(x.WarehouseCode, x.WarehouseCode)),
            new("export.salesOrder.voucherType", x => x.VoucherType),
            new("export.salesOrder.deliveryDate", x => x.DeliveryDate),
            new("export.salesOrder.paymentTerms", x => x.PaymentTerms),
            new("export.salesOrder.status", x => StatusName(x.Status))
        };
        if (canSeePrice)
        {
            columns.Add(new("export.salesOrder.subTotal", x => x.SubTotal));
            columns.Add(new("export.salesOrder.taxAmount", x => x.TaxAmount));
            columns.Add(new("export.salesOrder.totalValue", x => x.TotalValue));
        }
        var content = excel.Write("export.salesOrder.sheet", columns, list);
        // RecordAsync only adds the row to the context: it is written by this SaveChanges.
        await audit.RecordAsync(new AuditEntry(Function, "salesOrder", "export", null, AuditActions.Export, [],
            $"{total} rows; search={query.Search}; status={query.Status}; warehouse={query.Warehouse}; customer={query.Customer}; type={query.VoucherType}; code={query.Code}; from={query.From}; to={query.To}"), ct);
        await db.SaveChangesAsync(ct);
        return new ExportFile(content, $"DonBanHang_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    public async Task<SalesOrderDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        await EnsureActionAsync(userId, row, DocumentAction.View, ct);
        return (await ToDtosAsync([row], await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct), ct))[0];
    }

    public async Task<IReadOnlyList<OpenSalesOrderDto>> GetOpenAsync(int userId, string unitCode, long? exceptIssueId, CancellationToken ct)
    {
        var canSeePrice = await permissions.HasRightAsync(userId, "inv_issue", SpecialRightCatalog.ViewPrice, ct);
        var rows = await db.SalesOrders.AsNoTracking().Include(x => x.Lines)
            .Where(x => x.UnitCode == unitCode && x.Status == "Approved")
            .OrderByDescending(x => x.DocumentDate).ThenByDescending(x => x.Id).ToListAsync(ct);
        var issued = await SalesOrderProgress.IssuedByLineAsync(db, rows.SelectMany(x => x.Lines).Select(x => x.Id).ToList(), exceptIssueId, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var result = new List<OpenSalesOrderDto>();
        foreach (var row in rows)
        {
            var lines = row.Lines.OrderBy(x => x.LineNo).Select(x =>
            {
                var done = issued.GetValueOrDefault(x.Id);
                return new OpenSalesOrderLineDto(x.Id, x.MaterialCode, x.MaterialName, x.UomCode, x.Quantity, done,
                    x.Quantity - done, canSeePrice ? x.UnitPrice : 0, x.Note);
            }).Where(x => x.RemainingQuantity > 0).ToList();
            if (lines.Count == 0) continue;
            result.Add(new OpenSalesOrderDto(row.Id, row.Code, row.DocumentDate, row.DeliveryDate, row.WarehouseCode,
                warehouses.GetValueOrDefault(row.WarehouseCode, row.WarehouseCode), row.VoucherType, row.CustomerCode, row.CustomerName,
                row.DeliveryAddress, row.CurrencyCode, row.ExchangeRate, row.Note, lines, row.ProjectCode));
        }
        return result;
    }

    public async Task<SalesOrderDto> CreateAsync(int userId, string unitCode, SaveSalesOrderRequest request, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, PermissionAction.Create, ct);
        var check = await ValidateAsync(unitCode, request, ct);
        await ProjectChecks.EnsureAsync(db, request.ProjectCode, null, ct);
        var target = Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, unitCode, isOwner: true, target, ct);
        var id = await unitOfWork.ExecuteAsync(async token =>
        {
            var row = new SalesOrder
            {
                UnitCode = unitCode, DocumentDate = request.Date, CreatedDate = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            Apply(row, request, check);
            row.Code = await numbers.NextAsync("SO", unitCode, request.Date, token);
            db.SalesOrders.Add(row);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, row.Id, check.Names));
            audit.Attach(row, [new AuditChange("items", null, LineSummary(row.Lines))]);
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
            return row.Id;
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<SalesOrderDto> UpdateAsync(int userId, string unitCode, long id,
        SaveSalesOrderRequest request, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Edit, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("salesOrder.editDraftOnly");
        // Someone who may not see prices got 0 in the form: keep the prices already saved (matched by line and material), never overwrite them with 0.
        if (request.Items is not null && !await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct))
            request = request with { Items = request.Items.Select((item, index) => KeepPrice(item, row.Lines, index)).ToList() };
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        var check = await ValidateAsync(unitCode, request, ct);
        await ProjectChecks.EnsureAsync(db, request.ProjectCode, row.ProjectCode, ct);
        var target = Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, unitCode, row.CreatedBy == userId, target, ct);
        db.ExpectVersion(row, request.Version, touch: true);
        var before = LineSummary(row.Lines);
        await unitOfWork.ExecuteAsync(async token =>
        {
            Apply(row, request, check);
            db.SalesOrderLines.RemoveRange(row.Lines);
            row.Lines.Clear();
            audit.Attach(row, [new AuditChange("items", before, LineSummary(Lines(request, id, check.Names)))]);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, id, check.Names));
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<SalesOrderDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct)
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
        // An order is never posted: only submit, approve, cancel and reopen.
        var policyAction = normalized switch
        {
            "submit" => DocumentAction.Submit, "approve" => DocumentAction.Approve,
            "cancel" => DocumentAction.Cancel, "reopen" => DocumentAction.Reopen, _ => throw new BusinessRuleException("salesOrder.invalidAction")
        };
        if (normalized == "cancel" && row.Status == "Pending")
            throw new BusinessRuleException("salesOrder.withdrawBeforeCancel");
        await EnsureActionAsync(userId, row, policyAction, ct);
        if (normalized == "reopen") await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        if (normalized == "cancel" && await SalesOrderProgress.HasIssuesAsync(db, row.Id, ct))
            throw new BusinessRuleException("salesOrder.cancelHasIssues");
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
            else if (normalized == "reopen")
            {
                // A cancelled order follows no other voucher, so it comes back as a draft as it is.
                row.Status = "Draft";
                row.ApprovedByUserId = null;
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
        if (target == DocumentStatus.Posted) throw new BusinessRuleException("salesOrder.noPosting");
        return target;
    }

    /// <summary>
    /// Saving straight at a later status needs the status right of the user for it in this company unit (rights are granted up to a
    /// status, so a later right includes the earlier steps) and the status in use there. Checked before anything is saved.
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
    private async Task AdvanceAsync(SalesOrder row, string unitCode, int userId, DocumentStatus target, CancellationToken token)
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
        if (row.Status != "Draft") throw new BusinessRuleException("salesOrder.deleteDraftOnly");
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            db.SalesOrderLines.RemoveRange(row.Lines);
            db.SalesOrders.Remove(row);
            await db.SaveChangesAsync(token);
        }, ct);
    }

    public async Task<SalesOrderDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct)
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

    private async Task<SalesOrder> FindAsync(long id, string unitCode, CancellationToken ct, bool tracking = false)
    {
        var query = db.SalesOrders.Include(x => x.Lines).Where(x => x.Id == id && x.UnitCode == unitCode);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct) ?? throw new NotFoundException("salesOrder.notFound");
    }

    private async Task<SalesOrderDto> ResultAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        return (await ToDtosAsync([row], canSeePrice, ct))[0];
    }

    private async Task EnsureActionAsync(int userId, SalesOrder row, DocumentAction action, CancellationToken ct)
    {
        var actor = DocumentActor.For(await permissions.GetEffectiveAsync(userId, ct),
            await permissions.GetRightsAsync(userId, ct), Function, row.CreatedBy == userId, row.UnitCode);
        var decision = DocumentStatusPolicy.Check(action, Enum.Parse<DocumentStatus>(row.Status), actor);
        if (!decision.Allowed) throw new ForbiddenException(decision.Reason ?? "permission.denied");
        if (action == DocumentAction.Submit) await statuses.EnsureEnabledAsync(row.UnitCode, Function, DocumentStatus.Pending, ct);
    }

    /// <summary>What a save found out while checking the order: the rate, the material names, the customer, the tax and the payment term.</summary>
    private sealed record Checked(decimal Rate, IReadOnlyDictionary<string, string> Names, string CustomerCode, string CustomerName,
        string? TaxRateCode, decimal TaxRate, string? PaymentTermCode, string? PaymentTermsText);

    private async Task<Checked> ValidateAsync(string unitCode, SaveSalesOrderRequest request, CancellationToken ct)
    {
        await fiscal.EnsureDateOpenAsync(unitCode, request.Date, ct);
        var warehouseCode = Guard.Code(request.WarehouseCode, 20, "field.warehouseCode");
        if (!await db.Warehouses.AnyAsync(x => x.Code == warehouseCode && x.IsActive, ct))
            throw new BusinessRuleException("salesOrder.warehouseInvalid");
        // The unit of the order must be one of the units the warehouse is for (shared warehouses suit every unit).
        if (!await db.UsableBy(unitCode).AnyAsync(x => x.Code == warehouseCode, ct))
            throw new BusinessRuleException("salesOrder.warehouseNotForUnit", warehouseCode, unitCode);
        var currencyCode = Guard.Code(request.CurrencyCode, 10, "field.currencyCode");
        if (!await db.Currencies.AnyAsync(x => x.Code == currencyCode && x.IsActive, ct))
            throw new BusinessRuleException("salesOrder.currencyInvalid");
        var rate = await rates.GetRateAsync(currencyCode, request.Date, ct);
        if (request.Items is null || request.Items.Count == 0) throw new BusinessRuleException("salesOrder.itemsRequired");
        if (request.Items.Count > 500) throw new BusinessRuleException("salesOrder.tooManyLines");
        _ = Guard.Required(request.VoucherType, 100, "field.salesOrderType");
        _ = Guard.Optional(request.PaymentTerms, 200, "field.paymentTerms");
        _ = Guard.Optional(request.DeliveryAddress, 300, "field.deliveryAddress");
        _ = Guard.Optional(request.Note, 1000, "field.note");
        if (request.DeliveryDate is { } due && due < request.Date) throw new BusinessRuleException("salesOrder.deliveryDateInvalid");
        var customerCode = Guard.Code(request.CustomerCode, 20, "field.customerCode");
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Code == customerCode, ct);
        if (customer is null || !customer.IsActive) throw new BusinessRuleException("salesOrder.customerInvalid", customerCode);
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
            if (tax is null || !tax.IsActive) throw new BusinessRuleException("salesOrder.taxInvalid", taxCode);
            taxRate = tax.IsExempt ? 0 : tax.Rate;
        }
        foreach (var item in request.Items)
        {
            _ = Guard.Code(item.MaterialCode, 50, "field.materialCode");
            _ = Guard.Code(item.UomCode, 20, "field.uomCode");
            _ = Guard.Optional(item.Note, 300, "field.note");
            if (item.Quantity <= 0 || item.UnitPrice < 0) throw new BusinessRuleException("salesOrder.lineInvalid");
        }
        // Every line points to a material and a unit of the catalogs (the name of the material is taken from the catalog).
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
        return new Checked(rate, materials.ToDictionary(x => x.Key, x => x.Value.Name), customer.Code, customer.Name, taxCode, taxRate, termCode, termsText);
    }

    private static void Apply(SalesOrder row, SaveSalesOrderRequest request, Checked check)
    {
        row.DocumentDate = request.Date;
        row.DeliveryDate = request.DeliveryDate;
        row.WarehouseCode = request.WarehouseCode.Trim().ToUpperInvariant();
        row.VoucherType = request.VoucherType.Trim();
        row.CustomerCode = check.CustomerCode;
        row.CustomerName = check.CustomerName;
        row.DeliveryAddress = request.DeliveryAddress?.Trim();
        row.PaymentTerms = check.PaymentTermsText;
        row.PaymentTermCode = check.PaymentTermCode;
        row.CurrencyCode = request.CurrencyCode.Trim().ToUpperInvariant();
        row.ExchangeRate = check.Rate;
        row.TaxRateCode = check.TaxRateCode;
        row.TaxRate = check.TaxRate;
        row.Note = request.Note?.Trim();
        row.ProjectCode = ProjectChecks.Normalize(request.ProjectCode);
        // The amounts of the lines are rounded one by one, as they are saved; the tax is on their total.
        row.SubTotal = request.Items.Sum(x => decimal.Round(x.Quantity * x.UnitPrice, 2));
        row.TaxAmount = decimal.Round(row.SubTotal * check.TaxRate / 100m, 2);
        row.TotalValue = decimal.Round((row.SubTotal + row.TaxAmount) * check.Rate, 2);
    }

    private static List<SalesOrderLine> Lines(SaveSalesOrderRequest request, long id, IReadOnlyDictionary<string, string> names)
    {
        var number = 0;
        return request.Items.Select(item => new SalesOrderLine
        {
            OrderId = id, LineNo = ++number,
            MaterialCode = item.MaterialCode.Trim().ToUpperInvariant(),
            MaterialName = names.GetValueOrDefault(item.MaterialCode.Trim().ToUpperInvariant(), string.Empty),
            UomCode = item.UomCode.Trim().ToUpperInvariant(), Quantity = item.Quantity, UnitPrice = item.UnitPrice,
            Amount = decimal.Round(item.Quantity * item.UnitPrice, 2), Note = item.Note?.Trim()
        }).ToList();
    }

    private static SaveSalesOrderLine KeepPrice(SaveSalesOrderLine item, IEnumerable<SalesOrderLine> savedLines, int index)
    {
        var saved = savedLines.OrderBy(x => x.LineNo).ElementAtOrDefault(index);
        var same = saved is not null && string.Equals(saved.MaterialCode, item.MaterialCode?.Trim(), StringComparison.OrdinalIgnoreCase);
        return item with { UnitPrice = same ? saved!.UnitPrice : 0 };
    }

    private static string LineSummary(IEnumerable<SalesOrderLine> lines) =>
        string.Join("; ", lines.OrderBy(x => x.LineNo).Select(x => $"{x.MaterialCode} {x.Quantity} {x.UomCode} x {x.UnitPrice}"));

    private async Task<IReadOnlyList<SalesOrderDto>> ToDtosAsync(List<SalesOrder> rows, bool canSeePrice, CancellationToken ct)
    {
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var ids = rows.SelectMany(x => new int?[] { x.CreatedBy, x.ApprovedByUserId }).Where(x => x.HasValue)
            .Select(x => x!.Value).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        var issued = await SalesOrderProgress.IssuedByLineAsync(db, rows.SelectMany(x => x.Lines).Select(x => x.Id).ToList(), null, ct);
        return rows.Select(row => new SalesOrderDto(row.Id, row.Code, row.DocumentDate, row.CreatedDate, row.DeliveryDate,
            row.UnitCode, units.GetValueOrDefault(row.UnitCode, row.UnitCode),
            row.WarehouseCode, warehouses.GetValueOrDefault(row.WarehouseCode, row.WarehouseCode), row.VoucherType,
            row.CustomerCode, row.CustomerName, row.DeliveryAddress, row.PaymentTerms, row.CurrencyCode, row.ExchangeRate,
            row.TaxRateCode, row.TaxRate, canSeePrice ? row.SubTotal : 0, canSeePrice ? row.TaxAmount : 0, row.Note, row.Status,
            canSeePrice ? row.TotalValue : 0, users.GetValueOrDefault(row.CreatedBy ?? 0, ""),
            row.ApprovedByUserId is int approved ? users.GetValueOrDefault(approved) : null,
            row.Lines.OrderBy(x => x.LineNo).Select(line => new SalesOrderLineDto(line.Id, line.MaterialCode, line.MaterialName,
                line.UomCode, line.Quantity, canSeePrice ? line.UnitPrice : 0, canSeePrice ? line.Amount : 0, line.Note,
                issued.GetValueOrDefault(line.Id))).ToList(), row.Version, ProjectCode: row.ProjectCode, PaymentTermCode: row.PaymentTermCode)).ToList();
    }
}
