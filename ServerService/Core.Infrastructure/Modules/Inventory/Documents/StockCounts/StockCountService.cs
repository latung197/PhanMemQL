using Core.Application.Common.Auditing;
using Core.Application.Common.Export;
using Core.Application.Common.Paging;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Fiscal;
using Core.Application.Modules.Inventory;
using Core.Application.Modules.Inventory.Documents.StockCounts;
using Core.Application.Modules.Inventory.Stock;
using Core.Application.Modules.Users;
using Core.Application.Modules.VoucherStatuses;
using Core.Application.Modules.VoucherNumbering;
using Core.Domain.Modules.Inventory.Documents.StockCounts;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Common.Persistence.Sql;
using Core.Infrastructure.Modules.Inventory;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory.Documents.StockCounts;

/// <summary>
/// Phiếu kiểm kê. The user types what was counted; the book stock (the ledger up to the counting date) and the difference are
/// worked out here, at every save and again at the moment of posting, so a count can never carry a made-up book figure. Posting
/// writes the differences to the stock ledger: a surplus comes in at the moving average cost, a shortage goes out at it.
/// </summary>
public sealed class StockCountService(CoreContext db, IUnitOfWork unitOfWork, IStockLedger ledger, ISqlExecutor sql,
    IVoucherNumberService numbers, IFiscalPeriodService fiscal, IPermissionService permissions,
    IDocumentApprovalService approvals, IAuditLog audit, IVoucherStatusService statuses, IExcelExporter excel) : IStockCountService
{
    private const string Function = "inv_audit_count";
    /// <summary>The ledger takes one direction per posting, so the shortage of a count is posted as a second voucher of its own.</summary>
    public const string OutSource = "inv_audit_count_out";

    public async Task<StockCountOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct) => new(
        await db.UsableBy(unitCode).AsNoTracking().OrderBy(x => x.Name).Select(x => new StockCountOption(x.Code, x.Name)).ToListAsync(ct),
        await db.MaterialGroups.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).Select(x => new StockCountOption(x.Code, x.Name)).ToListAsync(ct));

    private static readonly SortMap<StockCount> SortColumns = SortMap<StockCount>.By(x => x.Id, "date", defaultDescending: true)
        .Add("date", x => x.DocumentDate).Add("code", x => x.Code).Add("warehouse", x => x.WarehouseCode)
        .Add("counter", x => x.CounterName).Add("status", x => x.Status).Add("totalValue", x => x.TotalValue).AddRecordStamps();

    private async Task<IQueryable<StockCount>> FilterAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var rows = db.StockCounts.AsNoTracking().Where(x => x.UnitCode == unitCode);
        if (!await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewAll, ct)) rows = rows.Where(x => x.CreatedBy == userId);
        if (query.StatusFilter is { } status) { var text = status.ToString(); rows = rows.Where(x => x.Status == text); }
        if (!string.IsNullOrWhiteSpace(query.Warehouse)) { var wh = query.Warehouse.Trim().ToUpperInvariant(); rows = rows.Where(x => x.WarehouseCode == wh); }
        if (query.From is { } from) rows = rows.Where(x => x.DocumentDate >= from);
        if (query.To is { } to) rows = rows.Where(x => x.DocumentDate <= to);
        var codes = query.CodeParts;
        if (codes.Count == 1) { var pattern = PagingExtensions.ContainsPattern(codes[0]); rows = rows.Where(x => SearchFunctions.Matches(x.Code, pattern)); }
        else if (codes.Count > 1) rows = rows.Where(x => codes.Contains(x.Code));
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = PagingExtensions.ContainsPattern(query.Search);
            rows = rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Note, pattern)
                || SearchFunctions.Matches(x.CounterName, pattern) || SearchFunctions.Matches(x.Reason, pattern)
                || SearchFunctions.Matches(x.WarehouseCode, pattern)
                || db.Warehouses.Any(w => w.Code == x.WarehouseCode && SearchFunctions.Matches(w.Name, pattern))
                || x.Lines.Any(l => SearchFunctions.Matches(l.MaterialCode, pattern) || SearchFunctions.Matches(l.MaterialName, pattern)));
        }
        return rows;
    }

    /// <summary>A value column cannot be sorted by someone who may not see costs (the order would give them away).</summary>
    private static void EnsureSortAllowed(VoucherListQuery query, bool canSeeCost)
    {
        if (!canSeeCost && string.Equals(query.Sort, "totalValue", StringComparison.OrdinalIgnoreCase))
            throw new BusinessRuleException("paging.sortInvalid");
    }

    public async Task<PagedResult<StockCountDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var canSeeCost = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewCost, ct);
        EnsureSortAllowed(query, canSeeCost);
        var rows = await FilterAsync(userId, unitCode, query, ct);
        var page = await rows.ToPagedAsync(query, SortColumns, ct);
        var ids = page.Items.Select(x => x.Id).ToList();
        var lines = await db.StockCountLines.AsNoTracking().Where(x => ids.Contains(x.CountId)).ToListAsync(ct);
        foreach (var row in page.Items) row.Lines = lines.Where(x => x.CountId == row.Id).ToList();
        return new PagedResult<StockCountDto>(await ToDtosAsync(page.Items.ToList(), canSeeCost, ct), page.Total, page.Page, page.PageSize);
    }

    public async Task<ExportFile> ExportAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, Core.Domain.Modules.Users.PermissionAction.Export, ct);
        var canSeeCost = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewCost, ct);
        EnsureSortAllowed(query, canSeeCost);
        var rows = await FilterAsync(userId, unitCode, query, ct);
        var total = await rows.CountAsync(ct);
        if (total > PagingLimits.MaxExportRows) throw new BusinessRuleException("export.tooMany", PagingLimits.MaxExportRows);
        var list = await SortColumns.Apply(rows, query.Sort, query.Dir).ToListAsync(ct);
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var names = (await statuses.GetNamesAsync(unitCode, ct)).GetValueOrDefault("PKK");
        string StatusName(string status) => names?.GetValueOrDefault(status)?.Name ?? status;
        var columns = new List<ExportColumn<StockCount>>
        {
            new("export.stockCount.code", x => x.Code), new("export.stockCount.date", x => x.DocumentDate),
            new("export.stockCount.unit", x => units.GetValueOrDefault(x.UnitCode, x.UnitCode)),
            new("export.stockCount.warehouse", x => warehouses.GetValueOrDefault(x.WarehouseCode, x.WarehouseCode)),
            new("export.stockCount.counter", x => x.CounterName), new("export.stockCount.reason", x => x.Reason),
            new("export.stockCount.status", x => StatusName(x.Status))
        };
        if (canSeeCost)
        {
            columns.Add(new("export.stockCount.surplus", x => x.SurplusValue));
            columns.Add(new("export.stockCount.shortage", x => x.ShortageValue));
        }
        var content = excel.Write("export.stockCount.sheet", columns, list);
        await audit.RecordAsync(new AuditEntry(Function, "stockCount", "export", null, AuditActions.Export, [],
            $"{total} rows; search={query.Search}; status={query.Status}; warehouse={query.Warehouse}; code={query.Code}; from={query.From}; to={query.To}"), ct);
        await db.SaveChangesAsync(ct);
        return new ExportFile(content, $"PhieuKiemKe_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    public async Task<StockCountDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        await EnsureActionAsync(userId, row, DocumentAction.View, ct);
        return (await ToDtosAsync([row], await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewCost, ct), ct))[0];
    }

    // ------------------------------------------------------------------------------------------------ book stock

    private sealed class BookRow
    {
        public string MaterialCode { get; set; } = "";
        public string LotCode { get; set; } = "";
        public string LocationCode { get; set; } = "";
        public decimal Quantity { get; set; }
        public decimal MaterialQuantity { get; set; }
        public decimal MaterialValue { get; set; }
    }

    private async Task<List<BookRow>> BookRowsAsync(string unitCode, string warehouseCode, DateOnly asOf, CancellationToken ct) =>
        (await sql.QueryAsync<BookRow>(SqlScripts.Get("Inventory.Documents.StockCounts", "StockCountBook"), new { unit = unitCode, warehouse = warehouseCode, asOf = asOf.ToDateTime(TimeOnly.MinValue) }, ct)).ToList();

    /// <summary>Moving average cost per base unit of a material in the warehouse (0 when it has no stock there).</summary>
    private static decimal AverageCost(BookRow row) =>
        row.MaterialQuantity > 0 && row.MaterialValue > 0 ? decimal.Round(row.MaterialValue / row.MaterialQuantity, 4) : 0;

    public async Task<IReadOnlyList<StockCountBookLineDto>> GetBookStockAsync(int userId, string unitCode, StockCountBookQuery query, CancellationToken ct)
    {
        // Starting a count reads the stock of a warehouse: only for someone who may add or change counts.
        var matrix = await permissions.GetEffectiveAsync(userId, ct);
        if (!(matrix.TryGetValue(Function, out var fn) && (fn.Create || fn.Edit))) throw new ForbiddenException("permission.denied");
        var warehouseCode = Guard.Code(query.WarehouseCode, 20, "field.warehouseCode");
        if (!await db.UsableBy(unitCode).AnyAsync(x => x.Code == warehouseCode, ct)) throw new BusinessRuleException("stockCount.warehouseNotForUnit", warehouseCode, unitCode);
        var asOf = query.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var canSeeCost = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewCost, ct);
        var rows = await BookRowsAsync(unitCode, warehouseCode, asOf, ct);
        var materials = db.Materials.AsNoTracking().Where(x => x.IsActive && x.IsStockItem);
        if (!string.IsNullOrWhiteSpace(query.Group)) { var group = query.Group.Trim().ToUpperInvariant(); materials = materials.Where(x => x.MaterialGroupCode == group); }
        if (query.CycleOnly) materials = materials.Where(x => x.IsCycleCounted);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = PagingExtensions.ContainsPattern(query.Search);
            materials = materials.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern));
        }
        var catalog = await materials.ToDictionaryAsync(x => x.Code, ct);
        var result = new List<StockCountBookLineDto>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            if (!catalog.TryGetValue(row.MaterialCode, out var material)) continue;
            seen.Add(material.Code);
            if (row.Quantity == 0 && !query.IncludeZero) continue;
            var lotNo = row.LotCode.Length == 0 ? null : row.LotCode[(row.LotCode.IndexOf(StockCountRules.LotSeparator) + 1)..];
            result.Add(new StockCountBookLineDto(material.Code, material.Name, material.UomCode, lotNo, row.LocationCode.Length == 0 ? null : row.LocationCode,
                row.Quantity, canSeeCost ? AverageCost(row) : 0));
        }
        // Materials without any ledger row are listed (with 0) only when asked for: the count then starts from the whole catalog.
        if (query.IncludeZero)
            foreach (var material in catalog.Values.Where(x => !seen.Contains(x.Code)).OrderBy(x => x.Code))
                if (!material.TrackLot && !material.TrackLocation)
                    result.Add(new StockCountBookLineDto(material.Code, material.Name, material.UomCode, null, null, 0, 0));
        return result;
    }

    // ------------------------------------------------------------------------------------------------ save

    public async Task<StockCountDto> CreateAsync(int userId, string unitCode, SaveStockCountRequest request, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, Core.Domain.Modules.Users.PermissionAction.Create, ct);
        var check = await ValidateAsync(unitCode, request, ct);
        var target = VoucherTargetStatus.Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, unitCode, isOwner: true, target, ct);
        var id = await unitOfWork.ExecuteAsync(async token =>
        {
            var row = new StockCount { UnitCode = unitCode, DocumentDate = request.Date, CreatedDate = DateOnly.FromDateTime(DateTime.UtcNow) };
            Apply(row, request);
            row.Code = await numbers.NextAsync("PKK", unitCode, request.Date, token);
            db.StockCounts.Add(row);
            await db.SaveChangesAsync(token);
            var lines = await BuildLinesAsync(row, request, check, token);
            row.Lines.AddRange(lines);
            audit.Attach(row, [new AuditChange("items", null, LineSummary(lines))]);
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
            return row.Id;
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<StockCountDto> UpdateAsync(int userId, string unitCode, long id, SaveStockCountRequest request, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Edit, ct);
        // A posted count has written to the ledger: unpost it first (that takes the right and a month that is still open).
        if (row.Status != "Draft") throw new BusinessRuleException("stockCount.editDraftOnly");
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        var check = await ValidateAsync(unitCode, request, ct);
        var target = VoucherTargetStatus.Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, unitCode, row.CreatedBy == userId, target, ct);
        db.ExpectVersion(row, request.Version, touch: true);
        var before = LineSummary(row.Lines);
        await unitOfWork.ExecuteAsync(async token =>
        {
            Apply(row, request);
            db.StockCountLines.RemoveRange(row.Lines);
            row.Lines.Clear();
            await db.SaveChangesAsync(token);
            var lines = await BuildLinesAsync(row, request, check, token);
            audit.Attach(row, [new AuditChange("items", before, LineSummary(lines))]);
            row.Lines.AddRange(lines);
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<StockCountDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct)
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
        var policyAction = normalized switch
        {
            "submit" => DocumentAction.Submit, "approve" => DocumentAction.Approve,
            "post" => DocumentAction.Post, "unpost" => DocumentAction.Unpost,
            "cancel" => DocumentAction.Cancel, "reopen" => DocumentAction.Reopen, _ => throw new BusinessRuleException("stockCount.invalidAction")
        };
        if (normalized == "cancel" && row.Status == "Pending") throw new BusinessRuleException("stockCount.withdrawBeforeCancel");
        await EnsureActionAsync(userId, row, policyAction, ct);
        if (normalized is "reopen" or "post" or "unpost") await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            if (normalized == "submit")
            {
                await approvals.SubmitAsync(userId, unitCode, new SubmitDocumentRequest(Function, row.Code, row.Code, row.TotalValue), token);
                row.Status = "Pending";
            }
            else if (normalized == "approve")
            {
                // Approving is a status right: a draft, or every level still open, is approved at once by this user.
                await approvals.ApproveToEndAsync(userId, unitCode, Function, row.Code, row.Code, token);
                row.Status = "Approved";
                row.ApprovedByUserId = userId;
            }
            else if (normalized == "post")
            {
                // The posted right takes a draft or pending voucher through the approval first.
                if (row.Status != "Approved") await approvals.ApproveToEndAsync(userId, unitCode, Function, row.Code, row.Code, token);
                await PostAsync(row, unitCode, userId, token);
            }
            else if (normalized == "unpost") { await UnpostAsync(row, userId, token); row.Status = "Approved"; }
            else if (normalized == "reopen") { row.Status = "Draft"; row.ApprovedByUserId = null; }
            else row.Status = "Cancelled";
            await db.SaveChangesAsync(token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    /// <summary>Saving straight at a later status needs the user's status right for it in this company unit (see GoodsIssueService).</summary>
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
        if (target == DocumentStatus.Pending) await statuses.EnsureEnabledAsync(unitCode, Function, DocumentStatus.Pending, ct);
    }

    /// <summary>Takes the just saved draft to the status the user asked for, in the same transaction (any refusal rolls the save back).</summary>
    private async Task AdvanceAsync(StockCount row, string unitCode, int userId, DocumentStatus target, CancellationToken token)
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
            await PostAsync(row, unitCode, userId, token);
            await db.SaveChangesAsync(token);
        }
    }

    // ------------------------------------------------------------------------------------------------ posting

    /// <summary>
    /// Posts the count. The book stock is worked out again first (what the ledger holds now for the counting date), so the
    /// difference written to the ledger is the real one even if vouchers were entered for earlier dates since the count was saved.
    /// </summary>
    private async Task PostAsync(StockCount row, string unitCode, int userId, CancellationToken token)
    {
        await RecalculateAsync(row, row.Lines, token);
        var surplus = row.Lines.Where(x => x.DiffQuantity > 0).OrderBy(x => x.LineNo).ToList();
        var shortage = row.Lines.Where(x => x.DiffQuantity < 0).OrderBy(x => x.LineNo).ToList();
        var codes = row.Lines.Select(x => x.MaterialCode).Distinct().ToList();
        var flags = await db.Materials.AsNoTracking().Where(x => codes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => (x.TrackLot, x.TrackLocation), token);
        string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        StockLineInput Line(StockCountLine x, decimal quantity, decimal value)
        {
            var tracked = flags.GetValueOrDefault(x.MaterialCode);
            return new StockLineInput(x.Id, x.MaterialCode, quantity, x.UomCode, value,
                tracked.TrackLot ? Text(x.LotNumber) : null, null, null, tracked.TrackLocation ? Text(x.Position) : null);
        }
        // Shortage first: it can only fail on stock, and a failure then leaves nothing half done (one transaction anyway).
        if (shortage.Count > 0)
            await ledger.PostAsync(userId, new StockPosting(OutSource, row.Id, unitCode, row.WarehouseCode, row.DocumentDate, StockDirection.Out,
                shortage.Select(x => Line(x, -x.DiffQuantity, 0)).ToList()), token);
        if (surplus.Count > 0)
            await ledger.PostAsync(userId, new StockPosting(Function, row.Id, unitCode, row.WarehouseCode, row.DocumentDate, StockDirection.In,
                surplus.Select(x => Line(x, x.DiffQuantity, x.DiffValue)).ToList()), token);
        row.Status = "Posted";
    }

    private async Task UnpostAsync(StockCount row, int userId, CancellationToken token)
    {
        // The lines do not change after posting, so which of the two postings exist follows from the sign of the differences.
        if (row.Lines.Any(x => x.DiffQuantity < 0)) await ledger.UnpostAsync(userId, OutSource, row.Id, token);
        if (row.Lines.Any(x => x.DiffQuantity > 0)) await ledger.UnpostAsync(userId, Function, row.Id, token);
    }

    // ------------------------------------------------------------------------------------------------ reading and rules

    public async Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Cancel, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("stockCount.deleteDraftOnly");
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            db.StockCountLines.RemoveRange(row.Lines);
            db.StockCounts.Remove(row);
            await db.SaveChangesAsync(token);
        }, ct);
    }

    public async Task<StockCountDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct)
    {
        await PermissionGate.EnsureTouchAsync(permissions, userId, Function, ct);
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Reject, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            await approvals.RejectAsync(userId, unitCode, Function, row.Code, new ApprovalActionRequest(reason), token);
            row.Status = "Draft";
            await db.SaveChangesAsync(token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    private async Task<StockCount> FindAsync(long id, string unitCode, CancellationToken ct, bool tracking = false)
    {
        var query = db.StockCounts.Include(x => x.Lines).Where(x => x.Id == id && x.UnitCode == unitCode);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct) ?? throw new NotFoundException("stockCount.notFound");
    }

    private async Task<StockCountDto> ResultAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        return (await ToDtosAsync([row], await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewCost, ct), ct))[0];
    }

    private async Task EnsureActionAsync(int userId, StockCount row, DocumentAction action, CancellationToken ct)
    {
        var actor = DocumentActor.For(await permissions.GetEffectiveAsync(userId, ct), await permissions.GetRightsAsync(userId, ct), Function, row.CreatedBy == userId, row.UnitCode);
        var decision = DocumentStatusPolicy.Check(action, Enum.Parse<DocumentStatus>(row.Status), actor);
        if (!decision.Allowed) throw new ForbiddenException(decision.Reason ?? "permission.denied");
        if (action == DocumentAction.Submit) await statuses.EnsureEnabledAsync(row.UnitCode, Function, DocumentStatus.Pending, ct);
    }

    /// <summary>What a save found out while checking the request: the materials of its lines.</summary>
    private sealed record Checked(IReadOnlyDictionary<string, Core.Domain.Modules.Inventory.Material> Materials);

    private async Task<Checked> ValidateAsync(string unitCode, SaveStockCountRequest request, CancellationToken ct)
    {
        await fiscal.EnsureDateOpenAsync(unitCode, request.Date, ct);
        var warehouseCode = Guard.Code(request.WarehouseCode, 20, "field.warehouseCode");
        if (!await db.Warehouses.AnyAsync(x => x.Code == warehouseCode && x.IsActive, ct)) throw new BusinessRuleException("stockCount.warehouseInvalid");
        if (!await db.UsableBy(unitCode).AnyAsync(x => x.Code == warehouseCode, ct)) throw new BusinessRuleException("stockCount.warehouseNotForUnit", warehouseCode, unitCode);
        _ = Guard.Optional(request.CounterName, 200, "field.counterName");
        _ = Guard.Optional(request.Reason, 300, "field.countReason");
        _ = Guard.Optional(request.Note, 1000, "field.note");
        if (request.Items is null || request.Items.Count == 0) throw new BusinessRuleException("stockCount.itemsRequired");
        if (request.Items.Count > 2000) throw new BusinessRuleException("stockCount.tooManyLines");
        foreach (var item in request.Items)
        {
            _ = Guard.Code(item.MaterialCode, 50, "field.materialCode");
            _ = Guard.Optional(item.LotNumber, 64, "field.lotNumber");
            _ = Guard.Optional(item.Position, 100, "field.position");
            _ = Guard.Optional(item.Note, 300, "field.note");
            if (item.CountedQuantity < 0 || item.UnitCost < 0) throw new BusinessRuleException("stockCount.lineInvalid");
        }
        var codes = request.Items.Select(x => x.MaterialCode.Trim().ToUpperInvariant()).Distinct().ToList();
        var materials = await db.Materials.AsNoTracking().Where(x => codes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, ct);
        var keys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in request.Items)
        {
            var code = item.MaterialCode.Trim().ToUpperInvariant();
            if (!materials.TryGetValue(code, out var material) || !material.IsActive) throw new BusinessRuleException("voucherLine.materialInvalid", code);
            if (!material.IsStockItem) throw new BusinessRuleException("voucherLine.materialNotStock", code);
            var lot = material.TrackLot ? item.LotNumber?.Trim().ToUpperInvariant() : null;
            var position = material.TrackLocation ? item.Position?.Trim().ToUpperInvariant() : null;
            if (material.TrackLot && string.IsNullOrEmpty(lot)) throw new BusinessRuleException("stockCount.lotRequired", code);
            if (material.TrackLocation)
            {
                if (string.IsNullOrEmpty(position)) throw new BusinessRuleException("stockCount.locationRequired", code);
                if (!await db.StorageLocations.AnyAsync(x => x.Code == position && x.WarehouseCode == warehouseCode, ct))
                    throw new BusinessRuleException("voucherLine.locationInvalid", position, warehouseCode);
            }
            if (!keys.Add($"{code}|{lot}|{position}")) throw new BusinessRuleException("stockCount.duplicateLine", code);
        }
        return new Checked(materials);
    }

    private static void Apply(StockCount row, SaveStockCountRequest request)
    {
        row.DocumentDate = request.Date;
        row.WarehouseCode = request.WarehouseCode.Trim().ToUpperInvariant();
        row.CounterName = request.CounterName?.Trim();
        row.Reason = request.Reason?.Trim();
        row.Note = request.Note?.Trim();
    }

    private async Task<List<StockCountLine>> BuildLinesAsync(StockCount row, SaveStockCountRequest request, Checked check, CancellationToken ct)
    {
        var number = 0;
        var lines = request.Items.Select(item =>
        {
            var code = item.MaterialCode.Trim().ToUpperInvariant();
            var material = check.Materials[code];
            return new StockCountLine
            {
                CountId = row.Id, LineNo = ++number, MaterialCode = code, MaterialName = material.Name, UomCode = material.UomCode,
                LotNumber = material.TrackLot ? item.LotNumber?.Trim().ToUpperInvariant() : null,
                Position = material.TrackLocation ? item.Position?.Trim().ToUpperInvariant() : null,
                CountedQuantity = item.CountedQuantity, UnitCost = item.UnitCost, Note = item.Note?.Trim()
            };
        }).ToList();
        await RecalculateAsync(row, lines, ct);
        return lines;
    }

    /// <summary>
    /// Works out book stock, difference and value of every line from the ledger at the counting date, and the totals of the count.
    /// A line keeps the cost it already has when the material has no stock to give an average (a surplus then uses the typed cost).
    /// </summary>
    private async Task RecalculateAsync(StockCount row, IReadOnlyCollection<StockCountLine> lines, CancellationToken ct)
    {
        var rows = await BookRowsAsync(row.UnitCode, row.WarehouseCode, row.DocumentDate, ct);
        var slots = rows.ToDictionary(x => $"{x.MaterialCode}|{x.LotCode}|{x.LocationCode}", x => x, StringComparer.Ordinal);
        var perMaterial = rows.GroupBy(x => x.MaterialCode).ToDictionary(g => g.Key, g => AverageCost(g.First()));
        decimal surplus = 0, shortage = 0;
        foreach (var line in lines)
        {
            var lotCode = string.IsNullOrEmpty(line.LotNumber) ? "" : StockCountRules.LotCode(line.MaterialCode, line.LotNumber);
            var location = line.Position ?? "";
            line.BookQuantity = slots.TryGetValue($"{line.MaterialCode}|{lotCode}|{location}", out var slot) ? slot.Quantity : 0;
            line.DiffQuantity = line.CountedQuantity - line.BookQuantity;
            var average = perMaterial.GetValueOrDefault(line.MaterialCode);
            if (average > 0) line.UnitCost = average;
            line.DiffValue = decimal.Round(line.DiffQuantity * line.UnitCost, 2);
            if (line.DiffValue > 0) surplus += line.DiffValue; else shortage -= line.DiffValue;
        }
        row.SurplusValue = surplus;
        row.ShortageValue = shortage;
        row.TotalValue = surplus + shortage;
    }

    private static string LineSummary(IEnumerable<StockCountLine> lines) =>
        string.Join("; ", lines.OrderBy(x => x.LineNo).Select(x =>
            $"{x.MaterialCode}{(string.IsNullOrEmpty(x.LotNumber) ? "" : " lot " + x.LotNumber)}: sổ {x.BookQuantity} / kiểm {x.CountedQuantity}"));

    private async Task<IReadOnlyList<StockCountDto>> ToDtosAsync(List<StockCount> rows, bool canSeeCost, CancellationToken ct)
    {
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var ids = rows.SelectMany(x => new int?[] { x.CreatedBy, x.ApprovedByUserId }).Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId)).ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        return rows.Select(row => new StockCountDto(row.Id, row.Code, row.DocumentDate, row.CreatedDate, row.UnitCode,
            units.GetValueOrDefault(row.UnitCode, row.UnitCode), row.WarehouseCode, warehouses.GetValueOrDefault(row.WarehouseCode, row.WarehouseCode),
            row.CounterName, row.Reason, row.Note, row.Status,
            canSeeCost ? row.SurplusValue : 0, canSeeCost ? row.ShortageValue : 0, canSeeCost ? row.TotalValue : 0,
            users.GetValueOrDefault(row.CreatedBy ?? 0, ""), row.ApprovedByUserId is int approved ? users.GetValueOrDefault(approved) : null,
            row.Lines.OrderBy(x => x.LineNo).Select(x => new StockCountLineDto(x.Id, x.MaterialCode, x.MaterialName, x.UomCode, x.LotNumber, x.Position,
                x.BookQuantity, x.CountedQuantity, x.DiffQuantity, canSeeCost ? x.UnitCost : 0, canSeeCost ? x.DiffValue : 0, x.Note)).ToList(),
            row.Version)).ToList();
    }
}

/// <summary>Lot codes of the ledger are <c>MATERIAL@LOTNO</c> (the key of the lot catalog).</summary>
public static class StockCountRules
{
    public const char LotSeparator = '@';
    public static string LotCode(string materialCode, string lotNo) => LotKey.Of(materialCode, lotNo);
}
