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
using Core.Application.Modules.Purchasing.Documents.PurchaseRequests;
using Core.Application.Modules.Users;
using Core.Application.Modules.VoucherStatuses;
using Core.Application.Modules.VoucherNumbering;
using Core.Domain.Modules.Purchasing.Documents.PurchaseRequests;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Modules.Inventory;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Purchasing.Documents.PurchaseRequests;

/// <summary>
/// What the purchase orders have already ordered of the lines of requests: the sum of the quantities of the order lines that point to a
/// request line (<c>purchase_request_line_id</c>), on orders that are not cancelled. Nothing is stored on the request: deleting or
/// cancelling an order gives its quantity back.
/// </summary>
public static class PurchaseRequestProgress
{
    public static async Task<Dictionary<long, decimal>> OrderedByLineAsync(CoreContext db, IReadOnlyCollection<long> requestLineIds,
        long? exceptOrderId, CancellationToken ct)
    {
        if (requestLineIds.Count == 0) return [];
        var rows = await (from line in db.PurchaseOrderLines.AsNoTracking()
                          join order in db.PurchaseOrders.AsNoTracking() on line.OrderId equals order.Id
                          where line.PurchaseRequestLineId != null && requestLineIds.Contains(line.PurchaseRequestLineId.Value)
                                && order.Status != "Cancelled" && (exceptOrderId == null || order.Id != exceptOrderId)
                          select new { LineId = line.PurchaseRequestLineId!.Value, line.Quantity }).ToListAsync(ct);
        return rows.GroupBy(x => x.LineId).ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));
    }

    /// <summary>True when an order that is not cancelled still orders a line of the request.</summary>
    public static Task<bool> HasOrdersAsync(CoreContext db, long requestId, CancellationToken ct) =>
        (from line in db.PurchaseOrderLines.AsNoTracking()
         join order in db.PurchaseOrders.AsNoTracking() on line.OrderId equals order.Id
         join rl in db.PurchaseRequestLines.AsNoTracking() on line.PurchaseRequestLineId equals (long?)rl.Id
         where rl.RequestId == requestId && order.Status != "Cancelled"
         select line.Id).AnyAsync(ct);
}

/// <summary>
/// Phiếu yêu cầu mua hàng. Same layout, statuses, approval and "save at a status" flow as the issue request, and nothing is posted to a
/// ledger: a request only says what purchasing is asked to buy; purchase orders carry it out.
/// </summary>
public sealed class PurchaseRequestService(CoreContext db, IUnitOfWork unitOfWork, IVoucherNumberService numbers,
    IFiscalPeriodService fiscal, IExchangeRateService rates, IPermissionService permissions,
    IDocumentApprovalService approvals, IAuditLog audit, IVoucherStatusService statuses, IExcelExporter excel) : IPurchaseRequestService
{
    private const string Function = "pur_request";

    public async Task<PurchaseRequestOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct) => new(
        await db.UsableBy(unitCode).AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new PurchaseRequestOption(x.Code, x.Name)).ToListAsync(ct),
        await db.Currencies.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new PurchaseRequestOption(x.Code, x.Name)).ToListAsync(ct),
        await db.Departments.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new PurchaseRequestOption(x.Code, x.Name)).ToListAsync(ct),
        await db.Suppliers.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new PurchaseRequestOption(x.Code, x.Name)).ToListAsync(ct));

    private static readonly SortMap<PurchaseRequest> SortColumns = SortMap<PurchaseRequest>.By(x => x.Id, "date", defaultDescending: true)
        .Add("date", x => x.DocumentDate).Add("code", x => x.Code).Add("warehouse", x => x.WarehouseCode)
        .Add("voucherType", x => x.VoucherType).Add("supplier", x => x.SupplierName).Add("status", x => x.Status)
        .Add("totalValue", x => x.TotalValue).AddRecordStamps();

    /// <summary>The vouchers of the unit the user may see that the query's filters leave.</summary>
    private async Task<IQueryable<PurchaseRequest>> FilterAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var rows = db.PurchaseRequests.AsNoTracking().Where(x => x.UnitCode == unitCode);
        if (!await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewAll, ct)) rows = rows.Where(x => x.CreatedBy == userId);
        if (query.StatusFilter is { } status) { var text = status.ToString(); rows = rows.Where(x => x.Status == text); }
        if (!string.IsNullOrWhiteSpace(query.Warehouse)) { var wh = query.Warehouse.Trim().ToUpperInvariant(); rows = rows.Where(x => x.WarehouseCode == wh); }
        if (!string.IsNullOrWhiteSpace(query.Project)) { var pj = query.Project.Trim().ToUpperInvariant(); rows = rows.Where(x => x.ProjectCode == pj); }
        if (!string.IsNullOrWhiteSpace(query.VoucherType)) { var type = query.VoucherType.Trim(); rows = rows.Where(x => x.VoucherType == type); }
        if (!string.IsNullOrWhiteSpace(query.Department)) { var dept = query.Department.Trim().ToUpperInvariant(); rows = rows.Where(x => x.DepartmentCode == dept); }
        if (query.From is { } from) rows = rows.Where(x => x.DocumentDate >= from);
        if (query.To is { } to) rows = rows.Where(x => x.DocumentDate <= to);
        var codes = query.CodeParts;
        if (codes.Count == 1) { var pattern = PagingExtensions.ContainsPattern(codes[0]); rows = rows.Where(x => SearchFunctions.Matches(x.Code, pattern)); }
        else if (codes.Count > 1) rows = rows.Where(x => codes.Contains(x.Code));
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = PagingExtensions.ContainsPattern(query.Search);
            rows = rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Note, pattern)
                || SearchFunctions.Matches(x.SupplierName, pattern) || SearchFunctions.Matches(x.SupplierCode, pattern) || SearchFunctions.Matches(x.RequesterName, pattern) || x.DepartmentCode != null && SearchFunctions.Matches(x.DepartmentCode, pattern)
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

    public async Task<PagedResult<PurchaseRequestDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        EnsureSortAllowed(query, canSeePrice);
        var rows = await FilterAsync(userId, unitCode, query, ct);
        // The page is cut on the headers; the items of those few vouchers are read afterwards.
        var page = await rows.ToPagedAsync(query, SortColumns, ct);
        var ids = page.Items.Select(x => x.Id).ToList();
        var lines = await db.PurchaseRequestLines.AsNoTracking().Where(x => ids.Contains(x.RequestId)).ToListAsync(ct);
        foreach (var row in page.Items) row.Lines = lines.Where(x => x.RequestId == row.Id).ToList();
        return new PagedResult<PurchaseRequestDto>(await ToDtosAsync(page.Items.ToList(), canSeePrice, ct), page.Total, page.Page, page.PageSize);
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
        var names = (await statuses.GetNamesAsync(unitCode, ct)).GetValueOrDefault("YCM");
        string StatusName(string status) => names?.GetValueOrDefault(status)?.Name ?? status;
        var columns = new List<ExportColumn<PurchaseRequest>>
        {
            new("export.purchaseRequest.code", x => x.Code), new("export.purchaseRequest.date", x => x.DocumentDate),
            new("export.purchaseRequest.unit", x => units.GetValueOrDefault(x.UnitCode, x.UnitCode)),
            new("export.purchaseRequest.warehouse", x => warehouses.GetValueOrDefault(x.WarehouseCode, x.WarehouseCode)),
            new("export.purchaseRequest.voucherType", x => x.VoucherType), new("export.purchaseRequest.supplier", x => x.SupplierName),
            new("export.purchaseRequest.requester", x => x.RequesterName),
            new("export.purchaseRequest.requiredDate", x => x.RequiredDate),
            new("export.purchaseRequest.status", x => StatusName(x.Status))
        };
        if (canSeePrice) columns.Add(new("export.purchaseRequest.totalValue", x => x.TotalValue));
        var content = excel.Write("export.purchaseRequest.sheet", columns, list);
        // RecordAsync only adds the row to the context: it is written by this SaveChanges.
        await audit.RecordAsync(new AuditEntry(Function, "purchaseRequest", "export", null, AuditActions.Export, [],
            $"{total} rows; search={query.Search}; status={query.Status}; warehouse={query.Warehouse}; type={query.VoucherType}; code={query.Code}; from={query.From}; to={query.To}"), ct);
        await db.SaveChangesAsync(ct);
        return new ExportFile(content, $"PhieuYeuCauMuaHang_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    public async Task<PurchaseRequestDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        await EnsureActionAsync(userId, row, DocumentAction.View, ct);
        return (await ToDtosAsync([row], await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct), ct))[0];
    }

    public async Task<IReadOnlyList<OpenPurchaseRequestDto>> GetOpenAsync(int userId, string unitCode, long? exceptOrderId, CancellationToken ct)
    {
        var canSeePrice = await permissions.HasRightAsync(userId, "pur_order", SpecialRightCatalog.ViewPrice, ct);
        var rows = await db.PurchaseRequests.AsNoTracking().Include(x => x.Lines)
            .Where(x => x.UnitCode == unitCode && x.Status == "Approved")
            .OrderByDescending(x => x.DocumentDate).ThenByDescending(x => x.Id).ToListAsync(ct);
        var ordered = await PurchaseRequestProgress.OrderedByLineAsync(db, rows.SelectMany(x => x.Lines).Select(x => x.Id).ToList(), exceptOrderId, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var departments = await db.Departments.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var result = new List<OpenPurchaseRequestDto>();
        foreach (var row in rows)
        {
            var lines = row.Lines.OrderBy(x => x.LineNo).Select(x =>
            {
                var done = ordered.GetValueOrDefault(x.Id);
                return new OpenPurchaseRequestLineDto(x.Id, x.MaterialCode, x.MaterialName, x.UomCode, x.Quantity, done,
                    x.Quantity - done, canSeePrice ? x.UnitPrice : 0, x.Note);
            }).Where(x => x.RemainingQuantity > 0).ToList();
            if (lines.Count == 0) continue;
            result.Add(new OpenPurchaseRequestDto(row.Id, row.Code, row.DocumentDate, row.RequiredDate, row.WarehouseCode,
                warehouses.GetValueOrDefault(row.WarehouseCode, row.WarehouseCode), row.VoucherType,
                row.DepartmentCode is null ? null : departments.GetValueOrDefault(row.DepartmentCode, row.DepartmentCode),
                row.RequesterName, row.SupplierCode, row.SupplierName, row.CurrencyCode, row.ExchangeRate, row.Note, lines));
        }
        return result;
    }

    public async Task<PurchaseRequestDto> CreateAsync(int userId, string unitCode, SavePurchaseRequestRequest request, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, Core.Domain.Modules.Users.PermissionAction.Create, ct);
        var check = await ValidateAsync(unitCode, request, ct);
        await ProjectChecks.EnsureAsync(db, request.ProjectCode, null, ct);
        var target = Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, unitCode, isOwner: true, target, ct);
        var id = await unitOfWork.ExecuteAsync(async token =>
        {
            var row = new PurchaseRequest
            {
                UnitCode = unitCode, DocumentDate = request.Date, CreatedDate = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            Apply(row, request, check);
            row.Code = await numbers.NextAsync("YCM", unitCode, request.Date, token);
            db.PurchaseRequests.Add(row);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, row.Id, check.Names));
            audit.Attach(row, [new AuditChange("items", null, LineSummary(row.Lines))]);
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
            return row.Id;
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<PurchaseRequestDto> UpdateAsync(int userId, string unitCode, long id,
        SavePurchaseRequestRequest request, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Edit, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("purchaseRequest.editDraftOnly");
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
            db.PurchaseRequestLines.RemoveRange(row.Lines);
            row.Lines.Clear();
            audit.Attach(row, [new AuditChange("items", before, LineSummary(Lines(request, id, check.Names)))]);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, id, check.Names));
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<PurchaseRequestDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct)
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
        // A request is never posted: only submit, approve and cancel.
        var policyAction = normalized switch
        {
            "submit" => DocumentAction.Submit, "approve" => DocumentAction.Approve,
            "cancel" => DocumentAction.Cancel, "reopen" => DocumentAction.Reopen, _ => throw new BusinessRuleException("purchaseRequest.invalidAction")
        };
        if (normalized == "cancel" && row.Status == "Pending")
            throw new BusinessRuleException("purchaseRequest.withdrawBeforeCancel");
        await EnsureActionAsync(userId, row, policyAction, ct);
        if (normalized == "reopen") await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        if (normalized == "cancel" && await PurchaseRequestProgress.HasOrdersAsync(db, row.Id, ct))
            throw new BusinessRuleException("purchaseRequest.cancelHasOrders");
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

    /// <summary>The status to save at: Draft, Pending or Approved (a request has no Posted status).</summary>
    private static DocumentStatus Parse(string? value)
    {
        var target = VoucherTargetStatus.Parse(value);
        if (target == DocumentStatus.Posted) throw new BusinessRuleException("purchaseRequest.noPosting");
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
    private async Task AdvanceAsync(PurchaseRequest row, string unitCode, int userId, DocumentStatus target, CancellationToken token)
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

    /// <summary>Reopening a cancelled voucher: nothing it follows can be taken by others, so there is nothing to check.</summary>
    private static Task EnsureLinksStillFitAsync(PurchaseRequest row, CancellationToken ct) => Task.CompletedTask;

    public async Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Cancel, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("purchaseRequest.deleteDraftOnly");
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            db.PurchaseRequestLines.RemoveRange(row.Lines);
            db.PurchaseRequests.Remove(row);
            await db.SaveChangesAsync(token);
        }, ct);
    }

    public async Task<PurchaseRequestDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct)
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

    private async Task<PurchaseRequest> FindAsync(long id, string unitCode, CancellationToken ct, bool tracking = false)
    {
        var query = db.PurchaseRequests.Include(x => x.Lines).Where(x => x.Id == id && x.UnitCode == unitCode);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct) ?? throw new NotFoundException("purchaseRequest.notFound");
    }

    private async Task<PurchaseRequestDto> ResultAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        return (await ToDtosAsync([row], canSeePrice, ct))[0];
    }

    private async Task EnsureActionAsync(int userId, PurchaseRequest row, DocumentAction action, CancellationToken ct)
    {
        var actor = DocumentActor.For(await permissions.GetEffectiveAsync(userId, ct),
            await permissions.GetRightsAsync(userId, ct), Function, row.CreatedBy == userId, row.UnitCode);
        var decision = DocumentStatusPolicy.Check(action, Enum.Parse<DocumentStatus>(row.Status), actor);
        if (!decision.Allowed) throw new ForbiddenException(decision.Reason ?? "permission.denied");
        if (action == DocumentAction.Submit) await statuses.EnsureEnabledAsync(row.UnitCode, Function, DocumentStatus.Pending, ct);
    }

    /// <summary>What a save found out while checking the request: the exchange rate, the material names, the normalized department and the suggested supplier.</summary>
    private sealed record Checked(decimal Rate, IReadOnlyDictionary<string, string> Names, string? DepartmentCode, string? SupplierCode, string? SupplierName);

    private async Task<Checked> ValidateAsync(string unitCode, SavePurchaseRequestRequest request, CancellationToken ct)
    {
        await fiscal.EnsureDateOpenAsync(unitCode, request.Date, ct);
        var warehouseCode = Guard.Code(request.WarehouseCode, 20, "field.warehouseCode");
        if (!await db.Warehouses.AnyAsync(x => x.Code == warehouseCode && x.IsActive, ct))
            throw new BusinessRuleException("purchaseRequest.warehouseInvalid");
        // The unit of the request must be one of the units the warehouse is for (shared warehouses suit every unit).
        if (!await db.UsableBy(unitCode).AnyAsync(x => x.Code == warehouseCode, ct))
            throw new BusinessRuleException("purchaseRequest.warehouseNotForUnit", warehouseCode, unitCode);
        var currencyCode = Guard.Code(request.CurrencyCode, 10, "field.currencyCode");
        if (!await db.Currencies.AnyAsync(x => x.Code == currencyCode && x.IsActive, ct))
            throw new BusinessRuleException("purchaseRequest.currencyInvalid");
        var rate = await rates.GetRateAsync(currencyCode, request.Date, ct);
        if (request.Items is null || request.Items.Count == 0) throw new BusinessRuleException("purchaseRequest.itemsRequired");
        if (request.Items.Count > 500) throw new BusinessRuleException("purchaseRequest.tooManyLines");
        _ = Guard.Required(request.VoucherType, 100, "field.purchaseType");
        _ = Guard.Optional(request.RequesterName, 200, "field.requesterName");
        _ = Guard.Optional(request.Note, 1000, "field.note");
        if (request.RequiredDate is { } needed && needed < request.Date) throw new BusinessRuleException("purchaseRequest.requiredDateInvalid");
        var department = string.IsNullOrWhiteSpace(request.DepartmentCode) ? null : request.DepartmentCode.Trim().ToUpperInvariant();
        if (department is not null && !await db.Departments.AnyAsync(x => x.Code == department && x.IsActive, ct))
            throw new BusinessRuleException("purchaseRequest.departmentInvalid", department);
        var supplierCode = string.IsNullOrWhiteSpace(request.SupplierCode) ? null : request.SupplierCode.Trim().ToUpperInvariant();
        string? supplierName = null;
        if (supplierCode is not null)
        {
            var supplier = await db.Suppliers.AsNoTracking().FirstOrDefaultAsync(x => x.Code == supplierCode, ct);
            if (supplier is null || !supplier.IsActive) throw new BusinessRuleException("purchaseRequest.supplierInvalid", supplierCode);
            supplierName = supplier.Name;
        }
        foreach (var item in request.Items)
        {
            _ = Guard.Code(item.MaterialCode, 50, "field.materialCode");
            _ = Guard.Code(item.UomCode, 20, "field.uomCode");
            _ = Guard.Optional(item.Note, 300, "field.note");
            if (item.Quantity <= 0 || item.UnitPrice < 0) throw new BusinessRuleException("purchaseRequest.lineInvalid");
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
        }
        return new Checked(rate, materials.ToDictionary(x => x.Key, x => x.Value.Name), department, supplierCode, supplierName);
    }

    private static void Apply(PurchaseRequest row, SavePurchaseRequestRequest request, Checked check)
    {
        row.DocumentDate = request.Date;
        row.RequiredDate = request.RequiredDate;
        row.WarehouseCode = request.WarehouseCode.Trim().ToUpperInvariant();
        row.VoucherType = request.VoucherType.Trim();
        row.DepartmentCode = check.DepartmentCode;
        row.RequesterName = request.RequesterName?.Trim();
        row.SupplierCode = check.SupplierCode;
        row.SupplierName = check.SupplierName;
        row.CurrencyCode = request.CurrencyCode.Trim().ToUpperInvariant();
        row.ExchangeRate = check.Rate;
        row.Note = request.Note?.Trim();
        row.ProjectCode = ProjectChecks.Normalize(request.ProjectCode);
        row.TotalValue = decimal.Round(request.Items.Sum(x => x.Quantity * x.UnitPrice) * check.Rate, 2);
    }

    private static List<PurchaseRequestLine> Lines(SavePurchaseRequestRequest request, long id, IReadOnlyDictionary<string, string> names)
    {
        var number = 0;
        return request.Items.Select(item => new PurchaseRequestLine
        {
            RequestId = id, LineNo = ++number,
            MaterialCode = item.MaterialCode.Trim().ToUpperInvariant(),
            MaterialName = names.GetValueOrDefault(item.MaterialCode.Trim().ToUpperInvariant(), string.Empty),
            UomCode = item.UomCode.Trim().ToUpperInvariant(), Quantity = item.Quantity, UnitPrice = item.UnitPrice,
            Amount = decimal.Round(item.Quantity * item.UnitPrice, 2), Note = item.Note?.Trim()
        }).ToList();
    }

    private static SavePurchaseRequestLine KeepPrice(SavePurchaseRequestLine item, IEnumerable<PurchaseRequestLine> savedLines, int index)
    {
        var saved = savedLines.OrderBy(x => x.LineNo).ElementAtOrDefault(index);
        var same = saved is not null && string.Equals(saved.MaterialCode, item.MaterialCode?.Trim(), StringComparison.OrdinalIgnoreCase);
        return item with { UnitPrice = same ? saved!.UnitPrice : 0 };
    }

    private static string LineSummary(IEnumerable<PurchaseRequestLine> lines) =>
        string.Join("; ", lines.OrderBy(x => x.LineNo).Select(x => $"{x.MaterialCode} {x.Quantity} {x.UomCode} x {x.UnitPrice}"));

    private async Task<IReadOnlyList<PurchaseRequestDto>> ToDtosAsync(List<PurchaseRequest> rows, bool canSeePrice, CancellationToken ct)
    {
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var departments = await db.Departments.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var ids = rows.SelectMany(x => new int?[] { x.CreatedBy, x.ApprovedByUserId }).Where(x => x.HasValue)
            .Select(x => x!.Value).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        var ordered = await PurchaseRequestProgress.OrderedByLineAsync(db, rows.SelectMany(x => x.Lines).Select(x => x.Id).ToList(), null, ct);
        return rows.Select(row => new PurchaseRequestDto(row.Id, row.Code, row.DocumentDate, row.CreatedDate, row.RequiredDate,
            row.UnitCode, units.GetValueOrDefault(row.UnitCode, row.UnitCode),
            row.WarehouseCode, warehouses.GetValueOrDefault(row.WarehouseCode, row.WarehouseCode), row.VoucherType,
            row.DepartmentCode, row.DepartmentCode is null ? null : departments.GetValueOrDefault(row.DepartmentCode, row.DepartmentCode),
            row.RequesterName, row.SupplierCode, row.SupplierName, row.CurrencyCode, row.ExchangeRate, row.Note, row.Status,
            canSeePrice ? row.TotalValue : 0, users.GetValueOrDefault(row.CreatedBy ?? 0, ""),
            row.ApprovedByUserId is int approved ? users.GetValueOrDefault(approved) : null,
            row.Lines.OrderBy(x => x.LineNo).Select(line => new PurchaseRequestLineDto(line.Id, line.MaterialCode, line.MaterialName,
                line.UomCode, line.Quantity, canSeePrice ? line.UnitPrice : 0, canSeePrice ? line.Amount : 0, line.Note,
                ordered.GetValueOrDefault(line.Id))).ToList(), row.Version, ProjectCode: row.ProjectCode)).ToList();
    }
}
