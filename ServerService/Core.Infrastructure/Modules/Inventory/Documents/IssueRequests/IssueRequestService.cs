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
using Core.Application.Modules.Inventory.Documents.IssueRequests;
using Core.Application.Modules.Users;
using Core.Application.Modules.VoucherStatuses;
using Core.Application.Modules.VoucherNumbering;
using Core.Domain.Modules.Inventory.Documents.IssueRequests;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory.Documents.IssueRequests;

/// <summary>
/// What the goods issues have already carried out of the lines of requests: the sum of the quantities of the issue lines that
/// point to a request line (<c>issue_request_line_id</c>), on issues that are not cancelled. Nothing is stored on the request:
/// deleting or cancelling an issue gives its quantity back.
/// </summary>
public static class IssueRequestProgress
{
    public static async Task<Dictionary<long, decimal>> IssuedByLineAsync(CoreContext db, IReadOnlyCollection<long> requestLineIds,
        long? exceptIssueId, CancellationToken ct)
    {
        if (requestLineIds.Count == 0) return [];
        var rows = await (from line in db.GoodsIssueLines.AsNoTracking()
                          join issue in db.GoodsIssues.AsNoTracking() on line.IssueId equals issue.Id
                          where line.IssueRequestLineId != null && requestLineIds.Contains(line.IssueRequestLineId.Value)
                                && line.Kind == "ITEM" && issue.Status != "Cancelled" && (exceptIssueId == null || issue.Id != exceptIssueId)
                          select new { LineId = line.IssueRequestLineId!.Value, line.Quantity }).ToListAsync(ct);
        return rows.GroupBy(x => x.LineId).ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));
    }

    /// <summary>True when an issue that is not cancelled still carries out a line of the request.</summary>
    public static Task<bool> HasIssuesAsync(CoreContext db, long requestId, CancellationToken ct) =>
        (from line in db.GoodsIssueLines.AsNoTracking()
         join issue in db.GoodsIssues.AsNoTracking() on line.IssueId equals issue.Id
         join rl in db.IssueRequestLines.AsNoTracking() on line.IssueRequestLineId equals (long?)rl.Id
         where rl.RequestId == requestId && issue.Status != "Cancelled"
         select line.Id).AnyAsync(ct);
}

/// <summary>
/// Phiếu yêu cầu xuất kho. Same layout, statuses, approval and "save at a status" flow as the goods issue (it is copied from
/// GoodsIssueService), but nothing is posted to the stock ledger: a request only says what the warehouse is asked to issue.
/// </summary>
public sealed class IssueRequestService(CoreContext db, IUnitOfWork unitOfWork, IVoucherNumberService numbers,
    IFiscalPeriodService fiscal, IExchangeRateService rates, IPermissionService permissions,
    IDocumentApprovalService approvals, IAuditLog audit, IVoucherStatusService statuses, IExcelExporter excel) : IIssueRequestService
{
    private const string Function = "inv_issue_request";

    public async Task<IssueRequestOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct) => new(
        await db.UsableBy(unitCode).AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new IssueRequestOption(x.Code, x.Name)).ToListAsync(ct),
        await db.Currencies.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new IssueRequestOption(x.Code, x.Name)).ToListAsync(ct),
        await db.Departments.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new IssueRequestOption(x.Code, x.Name)).ToListAsync(ct));

    private static readonly SortMap<IssueRequest> SortColumns = SortMap<IssueRequest>.By(x => x.Id, "date", defaultDescending: true)
        .Add("date", x => x.DocumentDate).Add("code", x => x.Code).Add("warehouse", x => x.WarehouseCode)
        .Add("voucherType", x => x.VoucherType).Add("customer", x => x.CustomerName).Add("status", x => x.Status)
        .Add("totalValue", x => x.TotalValue).AddRecordStamps();

    /// <summary>The vouchers of the unit the user may see that the query's filters leave.</summary>
    private async Task<IQueryable<IssueRequest>> FilterAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var rows = db.IssueRequests.AsNoTracking().Where(x => x.UnitCode == unitCode);
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
                || SearchFunctions.Matches(x.CustomerName, pattern) || SearchFunctions.Matches(x.RequesterName, pattern) || x.DepartmentCode != null && SearchFunctions.Matches(x.DepartmentCode, pattern)
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

    public async Task<PagedResult<IssueRequestDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        EnsureSortAllowed(query, canSeePrice);
        var rows = await FilterAsync(userId, unitCode, query, ct);
        // The page is cut on the headers; the items of those few vouchers are read afterwards.
        var page = await rows.ToPagedAsync(query, SortColumns, ct);
        var ids = page.Items.Select(x => x.Id).ToList();
        var lines = await db.IssueRequestLines.AsNoTracking().Where(x => ids.Contains(x.RequestId)).ToListAsync(ct);
        foreach (var row in page.Items) row.Lines = lines.Where(x => x.RequestId == row.Id).ToList();
        return new PagedResult<IssueRequestDto>(await ToDtosAsync(page.Items.ToList(), canSeePrice, ct), page.Total, page.Page, page.PageSize);
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
        var names = (await statuses.GetNamesAsync(unitCode, ct)).GetValueOrDefault("YCX");
        string StatusName(string status) => names?.GetValueOrDefault(status)?.Name ?? status;
        var columns = new List<ExportColumn<IssueRequest>>
        {
            new("export.issueRequest.code", x => x.Code), new("export.issueRequest.date", x => x.DocumentDate),
            new("export.issueRequest.unit", x => units.GetValueOrDefault(x.UnitCode, x.UnitCode)),
            new("export.issueRequest.warehouse", x => warehouses.GetValueOrDefault(x.WarehouseCode, x.WarehouseCode)),
            new("export.issueRequest.voucherType", x => x.VoucherType), new("export.issueRequest.customer", x => x.CustomerName),
            new("export.issueRequest.requester", x => x.RequesterName),
            new("export.issueRequest.requiredDate", x => x.RequiredDate),
            new("export.issueRequest.status", x => StatusName(x.Status))
        };
        if (canSeePrice) columns.Add(new("export.issueRequest.totalValue", x => x.TotalValue));
        var content = excel.Write("export.issueRequest.sheet", columns, list);
        // RecordAsync only adds the row to the context: it is written by this SaveChanges.
        await audit.RecordAsync(new AuditEntry(Function, "issueRequest", "export", null, AuditActions.Export, [],
            $"{total} rows; search={query.Search}; status={query.Status}; warehouse={query.Warehouse}; type={query.VoucherType}; code={query.Code}; from={query.From}; to={query.To}"), ct);
        await db.SaveChangesAsync(ct);
        return new ExportFile(content, $"PhieuYeuCauXuatKho_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    public async Task<IssueRequestDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        await EnsureActionAsync(userId, row, DocumentAction.View, ct);
        return (await ToDtosAsync([row], await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct), ct))[0];
    }

    public async Task<IReadOnlyList<OpenIssueRequestDto>> GetOpenAsync(int userId, string unitCode, long? exceptIssueId, CancellationToken ct)
    {
        var canSeePrice = await permissions.HasRightAsync(userId, "inv_issue", SpecialRightCatalog.ViewPrice, ct);
        var rows = await db.IssueRequests.AsNoTracking().Include(x => x.Lines)
            .Where(x => x.UnitCode == unitCode && x.Status == "Approved")
            .OrderByDescending(x => x.DocumentDate).ThenByDescending(x => x.Id).ToListAsync(ct);
        var issued = await IssueRequestProgress.IssuedByLineAsync(db, rows.SelectMany(x => x.Lines).Select(x => x.Id).ToList(), exceptIssueId, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var departments = await db.Departments.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var result = new List<OpenIssueRequestDto>();
        foreach (var row in rows)
        {
            var lines = row.Lines.OrderBy(x => x.LineNo).Select(x =>
            {
                var done = issued.GetValueOrDefault(x.Id);
                return new OpenIssueRequestLineDto(x.Id, x.MaterialCode, x.MaterialName, x.UomCode, x.Quantity, done,
                    x.Quantity - done, canSeePrice ? x.UnitPrice : 0, x.Note);
            }).Where(x => x.RemainingQuantity > 0).ToList();
            if (lines.Count == 0) continue;
            result.Add(new OpenIssueRequestDto(row.Id, row.Code, row.DocumentDate, row.RequiredDate, row.WarehouseCode,
                warehouses.GetValueOrDefault(row.WarehouseCode, row.WarehouseCode), row.VoucherType,
                row.DepartmentCode is null ? null : departments.GetValueOrDefault(row.DepartmentCode, row.DepartmentCode),
                row.RequesterName, row.CustomerName, row.CurrencyCode, row.ExchangeRate, row.Note, lines));
        }
        return result;
    }

    public async Task<IssueRequestDto> CreateAsync(int userId, string unitCode, SaveIssueRequestRequest request, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, Core.Domain.Modules.Users.PermissionAction.Create, ct);
        var check = await ValidateAsync(unitCode, request, ct);
        await ProjectChecks.EnsureAsync(db, request.ProjectCode, null, ct);
        var target = Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, unitCode, isOwner: true, target, ct);
        var id = await unitOfWork.ExecuteAsync(async token =>
        {
            var row = new IssueRequest
            {
                UnitCode = unitCode, DocumentDate = request.Date, CreatedDate = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            Apply(row, request, check);
            row.Code = await numbers.NextAsync("YCX", unitCode, request.Date, token);
            db.IssueRequests.Add(row);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, row.Id, check.Names));
            audit.Attach(row, [new AuditChange("items", null, LineSummary(row.Lines))]);
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
            return row.Id;
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<IssueRequestDto> UpdateAsync(int userId, string unitCode, long id,
        SaveIssueRequestRequest request, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Edit, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("issueRequest.editDraftOnly");
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
            db.IssueRequestLines.RemoveRange(row.Lines);
            row.Lines.Clear();
            audit.Attach(row, [new AuditChange("items", before, LineSummary(Lines(request, id, check.Names)))]);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, id, check.Names));
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<IssueRequestDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct)
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
        // A request is never posted: only submit, approve and cancel.
        var policyAction = normalized switch
        {
            "submit" => DocumentAction.Submit, "approve" => DocumentAction.Approve,
            "cancel" => DocumentAction.Cancel, "reopen" => DocumentAction.Reopen, _ => throw new BusinessRuleException("issueRequest.invalidAction")
        };
        if (normalized == "cancel" && row.Status == "Pending")
            throw new BusinessRuleException("issueRequest.withdrawBeforeCancel");
        await EnsureActionAsync(userId, row, policyAction, ct);
        if (normalized == "reopen") await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        if (normalized == "cancel" && await IssueRequestProgress.HasIssuesAsync(db, row.Id, ct))
            throw new BusinessRuleException("issueRequest.cancelHasIssues");
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
        if (target == DocumentStatus.Posted) throw new BusinessRuleException("issueRequest.noPosting");
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

    /// <summary>Takes the just saved draft to the status the user asked for, in the same transaction (see GoodsIssueService.AdvanceAsync).</summary>
    private async Task AdvanceAsync(IssueRequest row, string unitCode, int userId, DocumentStatus target, CancellationToken token)
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
    private static Task EnsureLinksStillFitAsync(IssueRequest row, CancellationToken ct) => Task.CompletedTask;

    public async Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Cancel, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("issueRequest.deleteDraftOnly");
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            db.IssueRequestLines.RemoveRange(row.Lines);
            db.IssueRequests.Remove(row);
            await db.SaveChangesAsync(token);
        }, ct);
    }

    public async Task<IssueRequestDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct)
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

    private async Task<IssueRequest> FindAsync(long id, string unitCode, CancellationToken ct, bool tracking = false)
    {
        var query = db.IssueRequests.Include(x => x.Lines).Where(x => x.Id == id && x.UnitCode == unitCode);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct) ?? throw new NotFoundException("issueRequest.notFound");
    }

    private async Task<IssueRequestDto> ResultAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        return (await ToDtosAsync([row], canSeePrice, ct))[0];
    }

    private async Task EnsureActionAsync(int userId, IssueRequest row, DocumentAction action, CancellationToken ct)
    {
        var actor = DocumentActor.For(await permissions.GetEffectiveAsync(userId, ct),
            await permissions.GetRightsAsync(userId, ct), Function, row.CreatedBy == userId, row.UnitCode);
        var decision = DocumentStatusPolicy.Check(action, Enum.Parse<DocumentStatus>(row.Status), actor);
        if (!decision.Allowed) throw new ForbiddenException(decision.Reason ?? "permission.denied");
        if (action == DocumentAction.Submit) await statuses.EnsureEnabledAsync(row.UnitCode, Function, DocumentStatus.Pending, ct);
    }

    /// <summary>What a save found out while checking the request: the exchange rate, the material names and the normalized department.</summary>
    private sealed record Checked(decimal Rate, IReadOnlyDictionary<string, string> Names, string? DepartmentCode);

    private async Task<Checked> ValidateAsync(string unitCode, SaveIssueRequestRequest request, CancellationToken ct)
    {
        await fiscal.EnsureDateOpenAsync(unitCode, request.Date, ct);
        var warehouseCode = Guard.Code(request.WarehouseCode, 20, "field.warehouseCode");
        if (!await db.Warehouses.AnyAsync(x => x.Code == warehouseCode && x.IsActive, ct))
            throw new BusinessRuleException("issueRequest.warehouseInvalid");
        // The unit of the request must be one of the units the warehouse is for (shared warehouses suit every unit).
        if (!await db.UsableBy(unitCode).AnyAsync(x => x.Code == warehouseCode, ct))
            throw new BusinessRuleException("issueRequest.warehouseNotForUnit", warehouseCode, unitCode);
        var currencyCode = Guard.Code(request.CurrencyCode, 10, "field.currencyCode");
        if (!await db.Currencies.AnyAsync(x => x.Code == currencyCode && x.IsActive, ct))
            throw new BusinessRuleException("issueRequest.currencyInvalid");
        var rate = await rates.GetRateAsync(currencyCode, request.Date, ct);
        if (request.Items is null || request.Items.Count == 0) throw new BusinessRuleException("issueRequest.itemsRequired");
        if (request.Items.Count > 500) throw new BusinessRuleException("issueRequest.tooManyLines");
        _ = Guard.Required(request.VoucherType, 100, "field.issueRequestType");
        _ = Guard.Optional(request.RequesterName, 200, "field.requesterName");
        _ = Guard.Optional(request.CustomerName, 200, "field.customerName");
        _ = Guard.Optional(request.Note, 1000, "field.note");
        if (request.RequiredDate is { } needed && needed < request.Date) throw new BusinessRuleException("issueRequest.requiredDateInvalid");
        var department = string.IsNullOrWhiteSpace(request.DepartmentCode) ? null : request.DepartmentCode.Trim().ToUpperInvariant();
        if (department is not null && !await db.Departments.AnyAsync(x => x.Code == department && x.IsActive, ct))
            throw new BusinessRuleException("issueRequest.departmentInvalid", department);
        foreach (var item in request.Items)
        {
            _ = Guard.Code(item.MaterialCode, 50, "field.materialCode");
            _ = Guard.Code(item.UomCode, 20, "field.uomCode");
            _ = Guard.Optional(item.Note, 300, "field.note");
            if (item.Quantity <= 0 || item.UnitPrice < 0) throw new BusinessRuleException("issueRequest.lineInvalid");
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
        return new Checked(rate, materials.ToDictionary(x => x.Key, x => x.Value.Name), department);
    }

    private static void Apply(IssueRequest row, SaveIssueRequestRequest request, Checked check)
    {
        row.DocumentDate = request.Date;
        row.RequiredDate = request.RequiredDate;
        row.WarehouseCode = request.WarehouseCode.Trim().ToUpperInvariant();
        row.VoucherType = request.VoucherType.Trim();
        row.DepartmentCode = check.DepartmentCode;
        row.RequesterName = request.RequesterName?.Trim();
        row.CustomerName = request.CustomerName?.Trim();
        row.CurrencyCode = request.CurrencyCode.Trim().ToUpperInvariant();
        row.ExchangeRate = check.Rate;
        row.Note = request.Note?.Trim();
        row.ProjectCode = ProjectChecks.Normalize(request.ProjectCode);
        row.TotalValue = decimal.Round(request.Items.Sum(x => x.Quantity * x.UnitPrice) * check.Rate, 2);
    }

    private static List<IssueRequestLine> Lines(SaveIssueRequestRequest request, long id, IReadOnlyDictionary<string, string> names)
    {
        var number = 0;
        return request.Items.Select(item => new IssueRequestLine
        {
            RequestId = id, LineNo = ++number,
            MaterialCode = item.MaterialCode.Trim().ToUpperInvariant(),
            MaterialName = names.GetValueOrDefault(item.MaterialCode.Trim().ToUpperInvariant(), string.Empty),
            UomCode = item.UomCode.Trim().ToUpperInvariant(), Quantity = item.Quantity, UnitPrice = item.UnitPrice,
            Amount = decimal.Round(item.Quantity * item.UnitPrice, 2), Note = item.Note?.Trim()
        }).ToList();
    }

    private static string LineSummary(IEnumerable<IssueRequestLine> lines) =>
        string.Join("; ", lines.OrderBy(x => x.LineNo).Select(x => $"{x.MaterialCode} {x.Quantity} {x.UomCode} x {x.UnitPrice}"));

    private async Task<IReadOnlyList<IssueRequestDto>> ToDtosAsync(List<IssueRequest> rows, bool canSeePrice, CancellationToken ct)
    {
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var departments = await db.Departments.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var ids = rows.SelectMany(x => new int?[] { x.CreatedBy, x.ApprovedByUserId }).Where(x => x.HasValue)
            .Select(x => x!.Value).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        var issued = await IssueRequestProgress.IssuedByLineAsync(db, rows.SelectMany(x => x.Lines).Select(x => x.Id).ToList(), null, ct);
        return rows.Select(row => new IssueRequestDto(row.Id, row.Code, row.DocumentDate, row.CreatedDate, row.RequiredDate,
            row.UnitCode, units.GetValueOrDefault(row.UnitCode, row.UnitCode),
            row.WarehouseCode, warehouses.GetValueOrDefault(row.WarehouseCode, row.WarehouseCode), row.VoucherType,
            row.DepartmentCode, row.DepartmentCode is null ? null : departments.GetValueOrDefault(row.DepartmentCode, row.DepartmentCode),
            row.RequesterName, row.CustomerName, row.CurrencyCode, row.ExchangeRate, row.Note, row.Status,
            canSeePrice ? row.TotalValue : 0, users.GetValueOrDefault(row.CreatedBy ?? 0, ""),
            row.ApprovedByUserId is int approved ? users.GetValueOrDefault(approved) : null,
            row.Lines.OrderBy(x => x.LineNo).Select(line => new IssueRequestLineDto(line.Id, line.MaterialCode, line.MaterialName,
                line.UomCode, line.Quantity, canSeePrice ? line.UnitPrice : 0, canSeePrice ? line.Amount : 0, line.Note,
                issued.GetValueOrDefault(line.Id))).ToList(), row.Version, ProjectCode: row.ProjectCode)).ToList();
    }
}
