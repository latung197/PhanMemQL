using Core.Application.Common.Auditing;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Currencies;
using Core.Application.Modules.Fiscal;
using Core.Application.Modules.Inventory.Documents.GoodsIssues;
using Core.Application.Modules.Users;
using Core.Application.Modules.VoucherNumbering;
using Core.Domain.Modules.Inventory.Documents.GoodsIssues;
using Core.Infrastructure.Common.Persistence;
using Core.Application.Modules.Inventory.Stock;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory.Documents.GoodsIssues;

public sealed class GoodsIssueService(CoreContext db, IUnitOfWork unitOfWork, IStockLedger ledger,
    IVoucherNumberService numbers, IFiscalPeriodService fiscal, IExchangeRateService rates, IPermissionService permissions,
    IDocumentApprovalService approvals, IAuditLog audit) : IGoodsIssueService
{
    private const string Function = "inv_issue";

    public async Task<GoodsIssueOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct) => new(
        await db.UsableBy(unitCode).AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new GoodsIssueOption(x.Code, x.Name)).ToListAsync(ct),
        await db.Currencies.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new GoodsIssueOption(x.Code, x.Name)).ToListAsync(ct));

    public async Task<IReadOnlyList<GoodsIssueDto>> GetAllAsync(int userId, string unitCode, CancellationToken ct)
    {
        var canSeeAll = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewAll, ct);
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        var query = db.GoodsIssues.AsNoTracking().Include(x => x.Lines).Where(x => x.UnitCode == unitCode);
        if (!canSeeAll) query = query.Where(x => x.CreatedBy == userId);
        var rows = await query.OrderByDescending(x => x.DocumentDate).ThenByDescending(x => x.Id).ToListAsync(ct);
        return await ToDtosAsync(rows, canSeePrice, ct);
    }

    public async Task<GoodsIssueDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        await EnsureActionAsync(userId, row, DocumentAction.View, ct);
        return (await ToDtosAsync([row], await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct), ct))[0];
    }

    public async Task<GoodsIssueDto> CreateAsync(int userId, string unitCode, SaveGoodsIssueRequest request, CancellationToken ct)
    {
        await permissions.EnsureAllowedAsync(userId, Function, Core.Domain.Modules.Users.PermissionAction.Create, ct);
        var check = await ValidateAsync(unitCode, request, ct);
        var target = VoucherTargetStatus.Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, isOwner: true, target, ct);
        var id = await unitOfWork.ExecuteAsync(async token =>
        {
            var row = new GoodsIssue
            {
                UnitCode = unitCode, DocumentDate = request.Date, CreatedDate = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            Apply(row, request, check);
            row.Code = await numbers.NextAsync("PXK", unitCode, request.Date, token);
            db.GoodsIssues.Add(row);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, row.Id, check.Names));
            audit.Attach(row, [new AuditChange("items", null, LineSummary(row.Lines))]);
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
            return row.Id;
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<GoodsIssueDto> UpdateAsync(int userId, string unitCode, long id,
        SaveGoodsIssueRequest request, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Edit, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("issue.editDraftOnly");
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        var check = await ValidateAsync(unitCode, request, ct);
        var target = VoucherTargetStatus.Parse(request.TargetStatus);
        await EnsureTargetAllowedAsync(userId, row.CreatedBy == userId, target, ct);
        db.ExpectVersion(row, request.Version, touch: true);
        var before = LineSummary(row.Lines);
        await unitOfWork.ExecuteAsync(async token =>
        {
            Apply(row, request, check);
            db.GoodsIssueLines.RemoveRange(row.Lines);
            row.Lines.Clear();
            audit.Attach(row, [new AuditChange("items", before, LineSummary(Lines(request, id, check.Names)))]);
            await db.SaveChangesAsync(token);
            row.Lines.AddRange(Lines(request, id, check.Names));
            await db.SaveChangesAsync(token);
            await AdvanceAsync(row, unitCode, userId, target, token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    public async Task<GoodsIssueDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct)
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
            "cancel" => DocumentAction.Cancel, _ => throw new BusinessRuleException("issue.invalidAction")
        };
        if (normalized == "cancel" && row.Status == "Pending")
            throw new BusinessRuleException("issue.withdrawBeforeCancel");
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
                await ledger.PostAsync(userId, await ToPostingAsync(row, unitCode, token), token);
                row.Status = "Posted";
            }
            else if (normalized == "unpost")
            {
                await ledger.UnpostAsync(userId, Function, row.Id, token);
                row.Status = "Approved";
            }
            else row.Status = "Cancelled";
            await db.SaveChangesAsync(token);
        }, ct);
        return await ResultAsync(userId, unitCode, id, ct);
    }

    /// <summary>Saving straight at Posted also needs the POST right (checked before anything is saved).</summary>
    private async Task EnsureTargetAllowedAsync(int userId, bool isOwner, DocumentStatus target, CancellationToken ct)
    {
        if (target != DocumentStatus.Posted) return;
        var actor = DocumentActor.For(await permissions.GetEffectiveAsync(userId, ct), await permissions.GetRightsAsync(userId, ct), Function, isOwner);
        var decision = DocumentStatusPolicy.Check(DocumentAction.Post, DocumentStatus.Approved, actor);
        if (!decision.Allowed) throw new ForbiddenException(decision.Reason ?? "permission.denied");
    }

    /// <summary>
    /// Takes the just saved draft to the status the user asked for, in the same transaction: Pending sends it for approval as
    /// usual; Approved records the approval of every level by this user (they must be an approver of each); Posted then posts it
    /// to the stock ledger. Any refusal rolls the whole save back, so the voucher is never left half way.
    /// </summary>
    private async Task AdvanceAsync(GoodsIssue row, string unitCode, int userId, DocumentStatus target, CancellationToken token)
    {
        if (target == DocumentStatus.Draft) return;
        if (target == DocumentStatus.Pending)
        {
            await approvals.SubmitAsync(userId, unitCode, new SubmitDocumentRequest(Function, row.Code, row.Code, row.TotalValue), token);
            return;
        }
        await approvals.EnsureCanApproveDirectAsync(userId, unitCode, Function, row.TotalValue, token);
        await approvals.ApproveDirectAsync(userId, unitCode, Function, row.Code, row.Code, token);
        if (target == DocumentStatus.Posted)
        {
            await ledger.PostAsync(userId, await ToPostingAsync(row, unitCode, token), token);
            row.Status = "Posted";
            await db.SaveChangesAsync(token);
        }
    }

    /// <summary>
    /// The ledger posting of an issue: its item lines (the material lines are the bill of materials, not stock out). Stock going
    /// out is valued by the ledger at the moving average of the warehouse, so the line price of the voucher is not sent. The lot
    /// number and position typed on a line only go to the ledger for materials that track lots / locations (until the issue picks
    /// them from the catalogs, other materials may still carry them as plain notes); a tracked material without them is refused.
    /// </summary>
    private async Task<StockPosting> ToPostingAsync(GoodsIssue row, string unitCode, CancellationToken ct)
    {
        var codes = row.Lines.Select(x => x.MaterialCode).Distinct().ToList();
        var flags = await db.Materials.AsNoTracking().Where(x => codes.Contains(x.Code))
            .ToDictionaryAsync(x => x.Code, x => (x.TrackLot, x.TrackLocation), ct);
        string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        var lines = row.Lines.Where(x => x.Kind == "ITEM").OrderBy(x => x.LineNo).Select(x =>
        {
            var tracked = flags.GetValueOrDefault(x.MaterialCode);
            return new StockLineInput(x.Id, x.MaterialCode, x.Quantity, x.UomCode, 0,
                tracked.TrackLot ? Text(x.LotNumber) : null, null, null, tracked.TrackLocation ? Text(x.Position) : null);
        }).ToList();
        return new StockPosting(Function, row.Id, unitCode, row.WarehouseCode, row.DocumentDate, StockDirection.Out, lines);
    }

    public async Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct, tracking: true);
        await EnsureActionAsync(userId, row, DocumentAction.Cancel, ct);
        if (row.Status != "Draft") throw new BusinessRuleException("issue.deleteDraftOnly");
        await fiscal.EnsureDateOpenAsync(unitCode, row.DocumentDate, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            db.GoodsIssueLines.RemoveRange(row.Lines);
            db.GoodsIssues.Remove(row);
            await db.SaveChangesAsync(token);
        }, ct);
    }

    public async Task<GoodsIssueDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct)
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

    private async Task<GoodsIssue> FindAsync(long id, string unitCode, CancellationToken ct, bool tracking = false)
    {
        var query = db.GoodsIssues.Include(x => x.Lines).Where(x => x.Id == id && x.UnitCode == unitCode);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(ct) ?? throw new NotFoundException("issue.notFound");
    }

    private async Task<GoodsIssueDto> ResultAsync(int userId, string unitCode, long id, CancellationToken ct)
    {
        var row = await FindAsync(id, unitCode, ct);
        var canSeePrice = await permissions.HasRightAsync(userId, Function, SpecialRightCatalog.ViewPrice, ct);
        return (await ToDtosAsync([row], canSeePrice, ct))[0];
    }

    private async Task EnsureActionAsync(int userId, GoodsIssue row, DocumentAction action, CancellationToken ct)
    {
        var actor = DocumentActor.For(await permissions.GetEffectiveAsync(userId, ct),
            await permissions.GetRightsAsync(userId, ct), Function, row.CreatedBy == userId);
        var decision = DocumentStatusPolicy.Check(action, Enum.Parse<DocumentStatus>(row.Status), actor);
        if (!decision.Allowed) throw new ForbiddenException(decision.Reason ?? "permission.denied");
    }

    /// <summary>What a save found out while checking the request: the exchange rate, the material names and the chosen supplier name.</summary>
    private sealed record Checked(decimal Rate, IReadOnlyDictionary<string, string> Names, string? PartnerName);

    private async Task<Checked> ValidateAsync(string unitCode, SaveGoodsIssueRequest request, CancellationToken ct)
    {
        await fiscal.EnsureDateOpenAsync(unitCode, request.Date, ct);
        var warehouseCode = Guard.Code(request.WarehouseCode, 20, "field.warehouseCode");
        if (!await db.Warehouses.AnyAsync(x => x.Code == warehouseCode && x.IsActive, ct))
            throw new BusinessRuleException("issue.warehouseInvalid");
        // The unit of the issue must be one of the units the warehouse is for (shared warehouses suit every unit).
        if (!await db.UsableBy(unitCode).AnyAsync(x => x.Code == warehouseCode, ct))
            throw new BusinessRuleException("issue.warehouseNotForUnit", warehouseCode, unitCode);
        var currencyCode = Guard.Code(request.CurrencyCode, 10, "field.currencyCode");
        if (!await db.Currencies.AnyAsync(x => x.Code == currencyCode && x.IsActive, ct))
            throw new BusinessRuleException("issue.currencyInvalid");
        var rate = await rates.GetRateAsync(currencyCode, request.Date, ct);
        if (request.Items is null || request.Items.Count == 0) throw new BusinessRuleException("issue.itemsRequired");
        if (request.Items.Count + (request.MaterialItems?.Count ?? 0) > 500)
            throw new BusinessRuleException("issue.tooManyLines");
        _ = Guard.Required(request.VoucherType, 100, "field.issueVoucherType");
        _ = Guard.Optional(request.ReceiverName, 200, "field.receiverName");
        _ = Guard.Optional(request.Note, 1000, "field.note");
        var all = request.Items.Concat(request.MaterialItems ?? []).ToList();
        foreach (var item in all)
        {
            _ = Guard.Code(item.MaterialCode, 50, "field.materialCode");
            _ = Guard.Code(item.UomCode, 20, "field.uomCode");
            _ = Guard.Optional(item.LotNumber, 64, "field.lotNumber");
            _ = Guard.Optional(item.Position, 100, "field.position");
            if (item.Quantity <= 0 || item.UnitPrice < 0) throw new BusinessRuleException("issue.lineInvalid");
        }
        // Every line points to a material and a unit of the catalogs (the name of the material is taken from the catalog).
        var materialCodes = all.Select(x => x.MaterialCode.Trim().ToUpperInvariant()).Distinct().ToList();
        var materials = await db.Materials.AsNoTracking().Where(x => materialCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, ct);
        var uomCodes = all.Select(x => x.UomCode.Trim().ToUpperInvariant()).Distinct().ToList();
        var activeUoms = (await db.Uoms.AsNoTracking().Where(x => uomCodes.Contains(x.Code) && x.IsActive).Select(x => x.Code).ToListAsync(ct)).ToHashSet();
        // The item lines (not the bill of materials) are the ones that move stock.
        bool IsStockLine(SaveGoodsIssueLine line) => request.Items.Any(x => ReferenceEquals(x, line));
        foreach (var item in all)
        {
            var code = item.MaterialCode.Trim().ToUpperInvariant();
            if (!materials.TryGetValue(code, out var material) || !material.IsActive)
                throw new BusinessRuleException("voucherLine.materialInvalid", code);
            if (IsStockLine(item) && !material.IsStockItem) throw new BusinessRuleException("voucherLine.materialNotStock", code);
            if (!activeUoms.Contains(item.UomCode.Trim().ToUpperInvariant()))
                throw new BusinessRuleException("voucherLine.uomInvalid", item.UomCode.Trim().ToUpperInvariant(), code);
            // A material tracked by location needs a location of this warehouse; for other materials the position is only a note.
            var position = item.Position?.Trim().ToUpperInvariant();
            if (IsStockLine(item) && material.TrackLocation && !string.IsNullOrEmpty(position)
                && !await db.StorageLocations.AnyAsync(x => x.Code == position && x.WarehouseCode == warehouseCode, ct))
                throw new BusinessRuleException("voucherLine.locationInvalid", position, warehouseCode);
        }
        var names = materials.ToDictionary(x => x.Key, x => x.Value.Name);
        string? partnerName = Guard.Optional(request.CustomerName, 200, "field.customerName");
        return new Checked(rate, names, partnerName);
    }

    private static void Apply(GoodsIssue row, SaveGoodsIssueRequest request, Checked check)
    {
        row.DocumentDate = request.Date;
        row.WarehouseCode = request.WarehouseCode.Trim().ToUpperInvariant();
        row.VoucherType = request.VoucherType.Trim();
        row.CurrencyCode = request.CurrencyCode.Trim().ToUpperInvariant();
        row.ExchangeRate = check.Rate;
        row.CustomerName = check.PartnerName?.Trim();
        row.ReceiverName = request.ReceiverName?.Trim();
        row.Note = request.Note?.Trim();
        row.TotalValue = decimal.Round(request.Items.Sum(x => x.Quantity * x.UnitPrice) * check.Rate, 2);
    }

    private static List<GoodsIssueLine> Lines(SaveGoodsIssueRequest request, long id, IReadOnlyDictionary<string, string> names)
    {
        var lines = new List<GoodsIssueLine>();
        void Add(IEnumerable<SaveGoodsIssueLine> source, string kind)
        {
            var number = 0;
            foreach (var item in source)
                lines.Add(new GoodsIssueLine
                {
                    IssueId = id, Kind = kind, LineNo = ++number,
                    MaterialCode = item.MaterialCode.Trim().ToUpperInvariant(),
                    MaterialName = names.GetValueOrDefault(item.MaterialCode.Trim().ToUpperInvariant(), string.Empty),
                    UomCode = item.UomCode.Trim().ToUpperInvariant(), Quantity = item.Quantity, UnitPrice = item.UnitPrice,
                    Amount = decimal.Round(item.Quantity * item.UnitPrice, 2),
                    LotNumber = item.LotNumber?.Trim(), Position = item.Position?.Trim()
                });
        }
        Add(request.Items, "ITEM");
        Add(request.MaterialItems ?? [], "MATERIAL");
        return lines;
    }

    private static string LineSummary(IEnumerable<GoodsIssueLine> lines) =>
        string.Join("; ", lines.OrderBy(x => x.Kind).ThenBy(x => x.LineNo)
            .Select(x => $"{x.Kind}:{x.MaterialCode} {x.Quantity} {x.UomCode} x {x.UnitPrice}"));

    private async Task<IReadOnlyList<GoodsIssueDto>> ToDtosAsync(List<GoodsIssue> rows, bool canSeePrice, CancellationToken ct)
    {
        var units = await db.CompanyUnits.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var warehouses = await db.Warehouses.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var ids = rows.SelectMany(x => new int?[] { x.CreatedBy, x.ApprovedByUserId }).Where(x => x.HasValue)
            .Select(x => x!.Value).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        return rows.Select(row =>
        {
            GoodsIssueLineDto Line(GoodsIssueLine line) => new(line.Id, line.Kind, line.MaterialCode, line.MaterialName,
                line.UomCode, line.Quantity, canSeePrice ? line.UnitPrice : 0,
                canSeePrice ? line.Amount : 0, line.LotNumber, line.Position);
            return new GoodsIssueDto(row.Id, row.Code, row.DocumentDate, row.CreatedDate,
                row.UnitCode, units.GetValueOrDefault(row.UnitCode, row.UnitCode),
                row.WarehouseCode, warehouses.GetValueOrDefault(row.WarehouseCode, row.WarehouseCode),
                row.VoucherType, row.CurrencyCode, row.ExchangeRate, row.CustomerName, row.ReceiverName,
                row.Note, row.Status, canSeePrice ? row.TotalValue : 0,
                users.GetValueOrDefault(row.CreatedBy ?? 0, ""),
                row.ApprovedByUserId is int approved ? users.GetValueOrDefault(approved) : null,
                row.Lines.Where(x => x.Kind == "ITEM").OrderBy(x => x.LineNo).Select(Line).ToList(),
                row.Lines.Where(x => x.Kind == "MATERIAL").OrderBy(x => x.LineNo).Select(Line).ToList(), row.Version);
        }).ToList();
    }
}
