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
/// Lệnh điều chuyển kho (LDC, function inv_transfer_order). The three transfer vouchers share this structure (see docs/kho/dieu-chuyen-kho.md); keep them in step.
/// same layout, statuses, approval and "save at a status" flow as the goods issue.
/// An order never posts to the stock ledger: it says what must move between the two warehouses; its statuses stop at Approved.
/// </summary>
public sealed class TransferOrderService(CoreContext db, IUnitOfWork unitOfWork,
    IVoucherNumberService numbers, IFiscalPeriodService fiscal, IPermissionService permissions,
    IDocumentApprovalService approvals, IAuditLog audit, IVoucherStatusService statuses, IExcelExporter excel) : ITransferOrderService
{
    private const string Function = "inv_transfer_order";

    public async Task<TransferOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct) => new(
        await db.UsableBy(unitCode).AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new TransferOption(x.Code, x.Name)).ToListAsync(ct));

    private static readonly SortMap<TransferOrder> SortColumns = SortMap<TransferOrder>.By(x => x.Id, "date", defaultDescending: true)
        .Add("date", x => x.DocumentDate).Add("code", x => x.Code).Add("warehouse", x => x.FromWarehouseCode)
        .Add("toWarehouse", x => x.ToWarehouseCode).Add("voucherType", x => x.Reason).Add("status", x => x.Status)
        .Add("totalValue", x => x.TotalValue).AddRecordStamps();

    /// <summary>The vouchers of the unit the user may see that the query's filters leave (the warehouse filter matches either warehouse).</summary>
    private async Task<IQueryable<TransferOrder>> FilterAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct)
    {
        var rows = db.TransferOrders.AsNoTracking().Where(x => x.UnitCode == unitCode);
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
        await Task.FromResult(false);

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
        var lines = await db.TransferOrderLines.AsNoTracking().Where(x => ids.Contains(x.OrderId)).ToListAsync(ct);
        foreach (var row in page.Items) row.Lines = lines.Where(x => x.OrderId == row.Id).ToList();
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
        var names = (await statuses.GetNamesAsync(unitCode, ct)).GetValueOrDefault("LDC");
        string StatusName(string status) => names?.GetValueOrDefault(status)?.Name ?? status;
        var columns = new List<ExportColumn<TransferOrder>>
        {
            new("export.transferOrder.code", x => x.Code), new("export.transferOrder.date", x => x.DocumentDate),
            new("export.transferOrder.unit", x => units.GetValueOrDefault(x.UnitCode, x.UnitCode)),
            new("export.transferOrder.fromWarehouse", x => warehouses.GetValueOrDefault(x.FromWarehouseCode, x.FromWarehouseCode)),
            new("export.transferOrder.toWarehouse", x => warehouses.GetValueOrDefault(x.ToWarehouseCode, x.ToWarehouseCode)),
            new("export.transferOrder.reason", x => x.Reason), new("export.transferOrder.person", x => x.PersonName),
            new("export.transferOrder.requiredDate", x => x.RequiredDate),
            new("export.transferOrder.status", x => StatusName(x.Status))
        };
        if (canSeeValue) columns.Add(new("export.transferOrder.totalValue", x => x.TotalValue));
        var content = excel.Write("export.transferOrder.sheet", columns, list);
        // RecordAsync only adds the row to the context: it is written by this SaveChanges.
        await audit.RecordAsync(new AuditEntry(Function, "transferOrder", "export", null, AuditActions.Export, [],
            $"{total} rows; search={query.Search}; status={query.Status}; warehouse={query.Warehouse}; type={query.VoucherType}; code={query.Code}; from={query.From}; to={query.To}"), ct);
        await db.SaveChangesAsync(ct);
        return new ExportFile(content, $"LenhDieuChuyenKho_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    public async Task<TransferDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        await EnsureActionAsync(userId, row, DocumentAction.View, ct);
        return (await ToDtosAsync([row], await CanSeeValueAsync(userId, ct), ct))[0];
    }

    /// <summary>Approved orders with something left to issue (see <see cref="ITransferOrderService.GetOpenAsync"/>).</summary>
    public async Task<IReadOnlyList<OpenTransferDto>> GetOpenAsync(int userId, string unitCode, long? exceptIssueId, CancellationToken ct)
    {
        var rows = await db.TransferOrders.AsNoTracking().Include(x => x.Lines)
            .Where(x => x.UnitCode == unitCode && x.Status == "Approved")
            .OrderByDescending(x => x.DocumentDate).ThenByDescending(x => x.Id).ToListAsync(ct);
        var done = await TransferProgress.IssuedByOrderLineAsync(db, rows.SelectMany(x => x.Lines).Select(x => x.Id).ToList(), exceptIssueId, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var result = new List<OpenTransferDto>();
        foreach (var row in rows)
        {
            var lines = row.Lines.OrderBy(x => x.LineNo).Select(x =>
            {
                var issued = done.GetValueOrDefault(x.Id);
                return new OpenTransferLineDto(x.Id, x.MaterialCode, x.MaterialName, x.UomCode, x.Quantity, issued, x.Quantity - issued, 0, null, null, x.Note);
            }).Where(x => x.RemainingQuantity > 0).ToList();
            if (lines.Count == 0) continue;
            result.Add(new OpenTransferDto(row.Id, row.Code, row.DocumentDate, row.RequiredDate, row.FromWarehouseCode,
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
            var row = new TransferOrder
            {
                UnitCode = unitCode, DocumentDate = request.Date, CreatedDate = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            Apply(row, request, check);
            row.Code = await numbers.NextAsync("LDC", unitCode, request.Date, token);
            db.TransferOrders.Add(row);
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
        await EnsureActionAsync(userId, row, DocumentAction.Edit, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("transferOrder.editDraftOnly");
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        var check = await ValidateAsync(unitCode, request, id, ct);
        var target = Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, unitCode, row.CreatedBy == userId, target, ct);
        db.ExpectVersion(row, request.Version, touch: true);
        var before = LineSummary(row.Lines);
        await unitOfWork.ExecuteAsync(async token =>
        {
            Apply(row, request, check);
            db.TransferOrderLines.RemoveRange(row.Lines);
            row.Lines.Clear();
            audit.Attach(row, [new AuditChange("items", before, LineSummary(Lines(request, id, check)))]);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, id, check));
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<TransferDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct)
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
            "cancel" => DocumentAction.Cancel, "reopen" => DocumentAction.Reopen, _ => throw new BusinessRuleException("transferOrder.invalidAction")
        };
        if (normalized == "cancel" && row.Status == "Pending")
            throw new BusinessRuleException("transferOrder.withdrawBeforeCancel");
        await EnsureActionAsync(userId, row, policyAction, ct);
        if (normalized == "reopen") await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        if (normalized == "cancel" && await TransferProgress.HasIssuesAsync(db, row.Id, ct))
            throw new BusinessRuleException("transferOrder.cancelHasIssues");
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

    /// <summary>The status to save at.</summary>
    private static DocumentStatus Parse(string? value)
    {
        var target = VoucherTargetStatus.Parse(value);
        if (target == DocumentStatus.Posted) throw new BusinessRuleException("transferOrder.noPosting");
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
    private async Task AdvanceAsync(TransferOrder row, string unitCode, int userId, DocumentStatus target, CancellationToken token)
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
    private static Task EnsureLinksStillFitAsync(TransferOrder row, CancellationToken ct) => Task.CompletedTask;

    public async Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Cancel, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("transferOrder.deleteDraftOnly");
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            db.TransferOrderLines.RemoveRange(row.Lines);
            db.TransferOrders.Remove(row);
            await db.SaveChangesAsync(token);
        }, ct);
    }

    public async Task<TransferDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct)
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

    private async Task<TransferOrder> FindAsync(long id, string unitCode, CancellationToken ct, bool tracking = false)
    {
        var query = db.TransferOrders.Include(x => x.Lines).Where(x => x.Id == id && x.UnitCode == unitCode);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct) ?? throw new NotFoundException("transferOrder.notFound");
    }

    private async Task<TransferDto> ResultAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        return (await ToDtosAsync([row], await CanSeeValueAsync(userId, ct), ct))[0];
    }

    private async Task EnsureActionAsync(int userId, TransferOrder row, DocumentAction action, CancellationToken ct)
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
        if (from == to) throw new BusinessRuleException("transferOrder.sameWarehouse");
        foreach (var code in new[] { from, to })
        {
            if (!await db.Warehouses.AnyAsync(x => x.Code == code && x.IsActive, ct)) throw new BusinessRuleException("transferOrder.warehouseInvalid", code);
            // The warehouse must be one the unit of the voucher may use (shared warehouses suit every unit).
            if (!await db.UsableBy(unitCode).AnyAsync(x => x.Code == code, ct)) throw new BusinessRuleException("transferOrder.warehouseNotForUnit", code, unitCode);
        }
        if (request.Items is null || request.Items.Count == 0) throw new BusinessRuleException("transferOrder.itemsRequired");
        if (request.Items.Count > 500) throw new BusinessRuleException("transferOrder.tooManyLines");
        _ = Guard.Required(request.Reason, 100, "field.transferReason");
        _ = Guard.Optional(request.PersonName, 200, "field.personName");
        _ = Guard.Optional(request.Note, 1000, "field.note");
        if (request.RequiredDate is { } required && required < request.Date) throw new BusinessRuleException("transferOrder.requiredDateInvalid");
        foreach (var item in request.Items)
        {
            _ = Guard.Code(item.MaterialCode, 50, "field.materialCode");
            _ = Guard.Code(item.UomCode, 20, "field.uomCode");
            _ = Guard.Optional(item.Note, 300, "field.note");
            if (item.Quantity <= 0) throw new BusinessRuleException("transferOrder.lineInvalid");
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
        return new Checked(materials.ToDictionary(x => x.Key, x => x.Value.Name), null, new Dictionary<long, SourceInfo>());
    }

    private static void Apply(TransferOrder row, SaveTransferRequest request, Checked check)
    {
        row.DocumentDate = request.Date;
        row.RequiredDate = request.RequiredDate;
        row.FromWarehouseCode = request.FromWarehouseCode.Trim().ToUpperInvariant();
        row.ToWarehouseCode = request.ToWarehouseCode.Trim().ToUpperInvariant();
        row.Reason = request.Reason.Trim();
        row.PersonName = request.PersonName?.Trim();
        row.Note = request.Note?.Trim();
    }

    private static List<TransferOrderLine> Lines(SaveTransferRequest request, long id, Checked check)
    {
        var lines = new List<TransferOrderLine>();
        var number = 0;
        foreach (var item in request.Items)
        {
            var material = item.MaterialCode.Trim().ToUpperInvariant();
            lines.Add(new TransferOrderLine
            {
                OrderId = id, LineNo = ++number, MaterialCode = material,
                MaterialName = check.Names.GetValueOrDefault(material, string.Empty),
                UomCode = item.UomCode.Trim().ToUpperInvariant(), Quantity = item.Quantity, Note = item.Note?.Trim(),
            });
        }
        return lines;
    }

    private static string LineSummary(IEnumerable<TransferOrderLine> lines) =>
        string.Join("; ", lines.OrderBy(x => x.LineNo).Select(x => $"{x.MaterialCode} {x.Quantity} {x.UomCode}"));

    private async Task<IReadOnlyList<TransferDto>> ToDtosAsync(List<TransferOrder> rows, bool canSeeValue, CancellationToken ct)
    {
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var ids = rows.SelectMany(x => new int?[] { x.CreatedBy, x.ApprovedByUserId }).Where(x => x.HasValue)
            .Select(x => x!.Value).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        var lineIds = rows.SelectMany(x => x.Lines).Select(l => l.Id).ToList();
        var done = await TransferProgress.IssuedByOrderLineAsync(db, lineIds, null, ct);
        return rows.Select(row =>
        {
            TransferLineDto Line(TransferOrderLine line) => new(line.Id, line.MaterialCode, line.MaterialName, line.UomCode, line.Quantity,
                0, 0, null, null, line.Note, done.GetValueOrDefault(line.Id));
            return new TransferDto(row.Id, row.Code, row.DocumentDate, row.CreatedDate, row.RequiredDate,
                row.UnitCode, units.GetValueOrDefault(row.UnitCode, row.UnitCode),
                row.FromWarehouseCode, warehouses.GetValueOrDefault(row.FromWarehouseCode, row.FromWarehouseCode),
                row.ToWarehouseCode, warehouses.GetValueOrDefault(row.ToWarehouseCode, row.ToWarehouseCode),
                row.Reason, row.PersonName, null, row.Note, row.Status, canSeeValue ? row.TotalValue : 0,
                users.GetValueOrDefault(row.CreatedBy ?? 0, ""),
                row.ApprovedByUserId is int approved ? users.GetValueOrDefault(approved) : null,
                row.Lines.OrderBy(x => x.LineNo).Select(Line).ToList(), row.Version);
        }).ToList();
    }
}
