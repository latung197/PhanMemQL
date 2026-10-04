using Core.Application.Common.Auditing;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Currencies;
using Core.Application.Modules.Fiscal;
using Core.Application.Modules.Inventory.Documents.GoodsReceipts;
using Core.Application.Modules.Users;
using Core.Application.Modules.VoucherNumbering;
using Core.Domain.Modules.Inventory.Documents.GoodsReceipts;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Common.Persistence.Sql;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory.Documents.GoodsReceipts;

public sealed class GoodsReceiptService(CoreContext db, IUnitOfWork unitOfWork, ISqlExecutor sql,
    IVoucherNumberService numbers, IFiscalPeriodService fiscal, IExchangeRateService rates, IPermissionService permissions,
    IDocumentApprovalService approvals, IAuditLog audit) : IGoodsReceiptService
{
    private const string Function = "inv_receipt";

    public async Task<GoodsReceiptOptionsDto> GetOptionsAsync(CancellationToken ct) => new(
        await db.Warehouses.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name)
            .Select(x => new GoodsReceiptOption(x.Code, x.Name)).ToListAsync(ct),
        await db.Currencies.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new GoodsReceiptOption(x.Code, x.Name)).ToListAsync(ct));

    public async Task<IReadOnlyList<GoodsReceiptDto>> GetAllAsync(int userId, string unitCode, CancellationToken ct)
    {
        var canSeeAll = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewAll, ct);
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        var query = db.GoodsReceipts.AsNoTracking().Include(x => x.Lines).Where(x => x.UnitCode == unitCode);
        if (!canSeeAll) query = query.Where(x => x.CreatedBy == userId);
        var rows = await query.OrderByDescending(x => x.DocumentDate).ThenByDescending(x => x.Id).ToListAsync(ct);
        return await ToDtosAsync(rows, canSeePrice, ct);
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
        var rate = await ValidateAsync(unitCode, request, ct);
        var id = await unitOfWork.ExecuteAsync(async token =>
        {
            var row = new GoodsReceipt
            {
                UnitCode = unitCode, DocumentDate = request.Date, CreatedDate = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            Apply(row, request, rate);
            row.Code = await numbers.NextAsync("PNK", unitCode, request.Date, token);
            db.GoodsReceipts.Add(row);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, row.Id));
            audit.Attach(row, [new AuditChange("items", null, LineSummary(row.Lines))]);
            await db.SaveChangesAsync(token);
            return row.Id;
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<GoodsReceiptDto> UpdateAsync(int userId, string unitCode, long id,
        SaveGoodsReceiptRequest request, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Edit, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("receipt.editDraftOnly");
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        var rate = await ValidateAsync(unitCode, request, ct);
        db.ExpectVersion(row, request.Version, touch: true);
        var before = LineSummary(row.Lines);
        await unitOfWork.ExecuteAsync(async token =>
        {
            Apply(row, request, rate);
            db.GoodsReceiptLines.RemoveRange(row.Lines);
            row.Lines.Clear();
            audit.Attach(row, [new AuditChange("items", before, LineSummary(Lines(request, id)))]);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, id));
            await db.SaveChangesAsync(token);
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
            "cancel" => DocumentAction.Cancel, _ => throw new BusinessRuleException("receipt.invalidAction")
        };
        if (normalized == "cancel" && row.Status == "Pending")
            throw new BusinessRuleException("receipt.withdrawBeforeCancel");
        await EnsureActionAsync(userId, row, policyAction, ct);
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
                await sql.ExecuteAsync(SqlScripts.Get("Inventory.Documents.GoodsReceipts", "PostReceipt"),
                    new { receiptId = row.Id }, token);
                row.Status = "Posted";
            }
            else if (normalized == "unpost")
            {
                await sql.ExecuteAsync("DELETE FROM erp_stock_movement WHERE source_function = @function AND source_id = @id",
                    new { function = Function, id = row.Id }, token);
                row.Status = "Approved";
            }
            else row.Status = "Cancelled";
            await db.SaveChangesAsync(token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Cancel, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("receipt.deleteDraftOnly");
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
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
            await permissions.GetRightsAsync(userId, ct), Function, row.CreatedBy == userId);
        var decision = DocumentStatusPolicy.Check(action, Enum.Parse<DocumentStatus>(row.Status), actor);
        if (!decision.Allowed) throw new ForbiddenException(decision.Reason ?? "permission.denied");
    }

    private async Task<decimal> ValidateAsync(string unitCode, SaveGoodsReceiptRequest request, CancellationToken ct)
    {
        await fiscal.EnsureDateOpenAsync(unitCode, request.Date, ct);
        var warehouseCode = Guard.Code(request.WarehouseCode, 20, "field.warehouseCode");
        if (!await db.Warehouses.AnyAsync(x => x.Code == warehouseCode && x.IsActive, ct))
            throw new BusinessRuleException("receipt.warehouseInvalid");
        var currencyCode = Guard.Code(request.CurrencyCode, 10, "field.currencyCode");
        if (!await db.Currencies.AnyAsync(x => x.Code == currencyCode && x.IsActive, ct))
            throw new BusinessRuleException("receipt.currencyInvalid");
        var rate = await rates.GetRateAsync(currencyCode, request.Date, ct);
        if (request.Items is null || request.Items.Count == 0) throw new BusinessRuleException("receipt.itemsRequired");
        if (request.Items.Count + (request.MaterialItems?.Count ?? 0) > 500)
            throw new BusinessRuleException("receipt.tooManyLines");
        _ = Guard.Required(request.VoucherType, 100, "field.voucherType");
        _ = Guard.Optional(request.SupplierName, 200, "field.supplierName");
        _ = Guard.Optional(request.DelivererName, 200, "field.delivererName");
        _ = Guard.Optional(request.Note, 1000, "field.note");
        foreach (var item in request.Items.Concat(request.MaterialItems ?? []))
        {
            _ = Guard.Code(item.ProductCode, 64, "field.productCode");
            _ = Guard.Required(item.ProductName, 200, "field.productName");
            _ = Guard.Required(item.Unit, 30, "field.unit");
            _ = Guard.Optional(item.LotNumber, 64, "field.lotNumber");
            _ = Guard.Optional(item.Position, 100, "field.position");
            if (item.Quantity <= 0 || item.UnitPrice < 0) throw new BusinessRuleException("receipt.lineInvalid");
        }
        return rate;
    }

    private static void Apply(GoodsReceipt row, SaveGoodsReceiptRequest request, decimal rate)
    {
        row.DocumentDate = request.Date;
        row.WarehouseCode = request.WarehouseCode.Trim().ToUpperInvariant();
        row.VoucherType = request.VoucherType.Trim();
        row.CurrencyCode = request.CurrencyCode.Trim().ToUpperInvariant();
        row.ExchangeRate = rate;
        row.SupplierName = request.SupplierName?.Trim();
        row.DelivererName = request.DelivererName?.Trim();
        row.Note = request.Note?.Trim();
        row.TotalValue = decimal.Round(request.Items.Sum(x => x.Quantity * x.UnitPrice) * rate, 2);
    }

    private static List<GoodsReceiptLine> Lines(SaveGoodsReceiptRequest request, long id)
    {
        var lines = new List<GoodsReceiptLine>();
        void Add(IEnumerable<SaveGoodsReceiptLine> source, string kind)
        {
            var number = 0;
            foreach (var item in source)
                lines.Add(new GoodsReceiptLine
                {
                    ReceiptId = id, Kind = kind, LineNo = ++number,
                    ProductCode = item.ProductCode.Trim().ToUpperInvariant(), ProductName = item.ProductName.Trim(),
                    Unit = item.Unit.Trim(), Quantity = item.Quantity, UnitPrice = item.UnitPrice,
                    Amount = decimal.Round(item.Quantity * item.UnitPrice, 2),
                    LotNumber = item.LotNumber?.Trim(), Position = item.Position?.Trim()
                });
        }
        Add(request.Items, "ITEM");
        Add(request.MaterialItems ?? [], "MATERIAL");
        return lines;
    }

    private static string LineSummary(IEnumerable<GoodsReceiptLine> lines) =>
        string.Join("; ", lines.OrderBy(x => x.Kind).ThenBy(x => x.LineNo)
            .Select(x => $"{x.Kind}:{x.ProductCode} {x.Quantity} {x.Unit} x {x.UnitPrice}"));

    private async Task<IReadOnlyList<GoodsReceiptDto>> ToDtosAsync(List<GoodsReceipt> rows, bool canSeePrice, CancellationToken ct)
    {
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var ids = rows.SelectMany(x => new int?[] { x.CreatedBy, x.ApprovedByUserId }).Where(x => x.HasValue)
            .Select(x => x!.Value).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        return rows.Select(row =>
        {
            GoodsReceiptLineDto Line(GoodsReceiptLine line) => new(line.Id, line.Kind, line.ProductCode, line.ProductName,
                line.Unit, line.Quantity, canSeePrice ? line.UnitPrice : 0,
                canSeePrice ? line.Amount : 0, line.LotNumber, line.Position);
            return new GoodsReceiptDto(row.Id, row.Code, row.DocumentDate, row.CreatedDate,
                row.UnitCode, units.GetValueOrDefault(row.UnitCode, row.UnitCode),
                row.WarehouseCode, warehouses.GetValueOrDefault(row.WarehouseCode, row.WarehouseCode),
                row.VoucherType, row.CurrencyCode, row.ExchangeRate, row.SupplierName, row.DelivererName,
                row.Note, row.Status, canSeePrice ? row.TotalValue : 0,
                users.GetValueOrDefault(row.CreatedBy ?? 0, ""),
                row.ApprovedByUserId is int approved ? users.GetValueOrDefault(approved) : null,
                row.Lines.Where(x => x.Kind == "ITEM").OrderBy(x => x.LineNo).Select(Line).ToList(),
                row.Lines.Where(x => x.Kind == "MATERIAL").OrderBy(x => x.LineNo).Select(Line).ToList(), row.Version);
        }).ToList();
    }
}
