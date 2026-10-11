using System.Globalization;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Inventory;
using Core.Application.Modules.Inventory.Stock;
using Core.Application.Modules.SystemConfig;
using Core.Domain.Modules.Inventory;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Common.Persistence.Sql;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory.Stock;

/// <summary>
/// The stock ledger (sổ kho). One call posts a whole voucher: it checks every line against the material catalog, writes the
/// ledger rows and moves the three balance tables (warehouse, lot, location), all in one transaction.
/// <list type="bullet">
/// <item>Ledger rows are never changed or deleted: unposting writes reversal rows, posting again raises <c>posting_seq</c>.</item>
/// <item>Stock going out is valued at the moving average of the warehouse balance; a reversal takes back the original value.</item>
/// <item>A balance row is locked (<c>FOR UPDATE</c>) before it is read, so two vouchers cannot both take the same stock; negative
/// stock is refused unless the company unit allows it (<c>allowNegativeStock</c> of the system parameters).</item>
/// <item>Lines are applied in a fixed order (material, lot, location), so concurrent vouchers lock rows in the same order.</item>
/// </list>
/// </summary>
public sealed class StockLedgerService(CoreContext db, ISqlExecutor sql, IUnitOfWork unitOfWork, ISystemParameters parameters) : IStockLedger
{
    private const string Module = "Inventory.Stock";

    /// <summary>Where one amount of stock sits: the key of the three balance tables (lot / location empty when not tracked).</summary>
    private readonly record struct Slot(string Unit, string Warehouse, string Material, string Lot, string Location);

    private sealed class BalanceRow { public decimal Quantity { get; set; } public decimal Value { get; set; } }

    private sealed class MovementRow
    {
        public long Id { get; set; }
        public string SourceFunction { get; set; } = "";
        public long SourceId { get; set; }
        public long SourceLineId { get; set; }
        public string UnitCode { get; set; } = "";
        public string WarehouseCode { get; set; } = "";
        public string MaterialCode { get; set; } = "";
        public string? LotCode { get; set; }
        public string? LocationCode { get; set; }
        public DateOnly DocumentDate { get; set; }
        public decimal Quantity { get; set; }
        public decimal Value { get; set; }
        public string UomCode { get; set; } = "";
        public string? LineUomCode { get; set; }
        public decimal? LineQuantity { get; set; }
        public int PostingSeq { get; set; }
    }

    private sealed class DiscrepancyRow
    {
        public string Level { get; set; } = "";
        public string UnitCode { get; set; } = "";
        public string WarehouseCode { get; set; } = "";
        public string MaterialCode { get; set; } = "";
        public string LotCode { get; set; } = "";
        public string LocationCode { get; set; } = "";
        public decimal LedgerQuantity { get; set; }
        public decimal BalanceQuantity { get; set; }
        public decimal LedgerValue { get; set; }
        public decimal BalanceValue { get; set; }
    }

    /// <summary>A line after its checks: the material, the lot and location it lands in, and its quantity in the base unit.</summary>
    private sealed record Resolved(StockLineInput Line, Material Material, string LotCode, string LocationCode, decimal BaseQuantity);

    // ---- Posting -----------------------------------------------------------------------------------------------------

    public Task PostAsync(int userId, StockPosting posting, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        if (posting.Lines.Count == 0) throw new BusinessRuleException("stock.noLines");
        var unit = posting.UnitCode;
        var warehouse = Guard.Code(posting.WarehouseCode, 20, "field.warehouseCode");
        var allowNegative = (await parameters.GetAsync(unit, token)).AllowNegativeStock;

        // The warehouse must be active and usable by the unit (a warehouse listing other units only is not).
        if (!await db.UsableBy(unit).AnyAsync(x => x.Code == warehouse, token))
            throw new BusinessRuleException("stock.warehouseInvalid", warehouse, unit);

        var args = new { function = posting.SourceFunction, id = posting.SourceId };
        if (await sql.ExecuteScalarAsync<long>(ActivePostingCount, args, token) > 0)
            throw new BusinessRuleException("stock.alreadyPosted");
        var seq = await sql.ExecuteScalarAsync<int>(NextPostingSeq, args, token);

        var resolved = await ResolveAsync(posting, warehouse, token);
        foreach (var item in resolved.OrderBy(x => x.Material.Code, StringComparer.Ordinal).ThenBy(x => x.LotCode, StringComparer.Ordinal)
                     .ThenBy(x => x.LocationCode, StringComparer.Ordinal).ThenBy(x => x.Line.SourceLineId))
        {
            var sign = posting.Direction == StockDirection.In ? 1m : -1m;
            var slot = new Slot(unit, warehouse, item.Material.Code, item.LotCode, item.LocationCode);
            var quantity = sign * item.BaseQuantity;
            // Stock in carries the line value; stock out leaves at the moving average (worked out under the row lock).
            var value = await ApplyAsync(slot, quantity, posting.Direction == StockDirection.In ? decimal.Round(item.Line.Value, 2) : null,
                userId, allowNegative, item.Material.UomCode, token);
            await sql.ExecuteAsync(InsertMovement, new
            {
                function = posting.SourceFunction, sourceId = posting.SourceId, sourceLineId = item.Line.SourceLineId,
                unit, warehouse, material = item.Material.Code, lot = item.LotCode.Length == 0 ? null : item.LotCode,
                location = item.LocationCode.Length == 0 ? null : item.LocationCode, date = posting.Date.ToDateTime(TimeOnly.MinValue),
                quantity, value, uom = item.Material.UomCode,
                lineUom = string.IsNullOrWhiteSpace(item.Line.UomCode) ? null : item.Line.UomCode.Trim().ToUpperInvariant(),
                lineQuantity = sign * item.Line.Quantity, seq, reversalOf = (long?)null, user = userId
            }, token);
        }
    }, ct);

    /// <summary>Checks every line and works out its lot, location and base quantity; creates the lots that stock coming in needs.</summary>
    private async Task<List<Resolved>> ResolveAsync(StockPosting posting, string warehouse, CancellationToken ct)
    {
        var codes = posting.Lines.Select(x => (x.MaterialCode ?? string.Empty).Trim().ToUpperInvariant()).Distinct().ToList();
        var materials = await db.Materials.AsNoTracking().Where(x => codes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, ct);
        var result = new List<Resolved>();
        foreach (var line in posting.Lines)
        {
            var code = (line.MaterialCode ?? string.Empty).Trim().ToUpperInvariant();
            if (!materials.TryGetValue(code, out var material)) throw new BusinessRuleException("stock.materialNotFound", code);
            if (!material.IsStockItem) throw new BusinessRuleException("stock.notStockItem", code);
            if (line.Quantity <= 0) throw new BusinessRuleException("stock.quantityInvalid", code);
            if (line.Value < 0) throw new BusinessRuleException("stock.valueInvalid", code);

            var factor = await FactorAsync(material, line.UomCode, ct);
            var baseQuantity = StockMath.ToBaseQuantity(line.Quantity, factor);
            if (baseQuantity <= 0) throw new BusinessRuleException("stock.quantityInvalid", code);

            var lotCode = await ResolveLotAsync(posting, material, line, ct);
            var locationCode = await ResolveLocationAsync(warehouse, material, line, ct);
            result.Add(new Resolved(line, material, lotCode, locationCode, baseQuantity));
        }
        return result;
    }

    private async Task<string> ResolveLotAsync(StockPosting posting, Material material, StockLineInput line, CancellationToken ct)
    {
        var given = string.IsNullOrWhiteSpace(line.LotNo) ? null : Guard.Code(line.LotNo, 30, "field.lotNo");
        if (!material.TrackLot)
        {
            if (given is not null) throw new BusinessRuleException("stock.lotNotAllowed", material.Code);
            return string.Empty;
        }
        if (given is null) throw new BusinessRuleException("stock.lotRequired", material.Code);

        var lotCode = LotKey.Of(material.Code, given);
        var lot = await db.Lots.AsNoTracking().FirstOrDefaultAsync(x => x.Code == lotCode, ct);
        if (lot is null)
        {
            if (posting.Direction == StockDirection.Out) throw new BusinessRuleException("stock.lotNotFound", given, material.Code);
            // Stock coming in opens the lot: its expiry date is needed when the material expires.
            if (material.HasExpiry && line.LotExpDate is null) throw new BusinessRuleException("stock.lotExpiryRequired", material.Code, given);
            if (line.LotMfgDate is { } mfg && line.LotExpDate is { } exp && exp < mfg) throw new BusinessRuleException("lot.dateOrder");
            db.Lots.Add(new Lot
            {
                Code = lotCode, MaterialCode = material.Code, LotNo = given, MfgDate = line.LotMfgDate, ExpDate = line.LotExpDate,
                QualityStatus = LotQuality.Passed, SortOrder = (await db.Lots.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1
            });
            await db.SaveChangesAsync(ct);
            return lotCode;
        }
        // A blocked lot takes and gives nothing; an expired lot cannot be issued.
        if (lot.QualityStatus == LotQuality.Blocked) throw new BusinessRuleException("stock.lotBlocked", given, material.Code);
        if (posting.Direction == StockDirection.Out && lot.ExpDate is { } expiry && expiry < posting.Date)
            throw new BusinessRuleException("stock.lotExpired", given, material.Code);
        return lotCode;
    }

    private async Task<string> ResolveLocationAsync(string warehouse, Material material, StockLineInput line, CancellationToken ct)
    {
        var given = string.IsNullOrWhiteSpace(line.LocationCode) ? null : Guard.Code(line.LocationCode, 30, "field.locationCode");
        if (!material.TrackLocation)
        {
            if (given is not null) throw new BusinessRuleException("stock.locationNotAllowed", material.Code);
            return string.Empty;
        }
        if (given is null) throw new BusinessRuleException("stock.locationRequired", material.Code);
        var location = await db.StorageLocations.AsNoTracking().FirstOrDefaultAsync(x => x.Code == given, ct);
        if (location is null || !location.IsActive || location.WarehouseCode != warehouse)
            throw new BusinessRuleException("stock.locationInvalid", given, warehouse);
        return given;
    }

    /// <summary>Base units in one line unit: 1 when the line uses the base unit, else from the conversion catalog (a conversion
    /// of the material wins over a general one; a conversion written the other way round is inverted).</summary>
    private async Task<decimal> FactorAsync(Material material, string? lineUom, CancellationToken ct)
    {
        var line = (lineUom ?? string.Empty).Trim().ToUpperInvariant();
        if (line.Length == 0 || line == material.UomCode) return 1m;
        var candidates = await db.UomConversions.AsNoTracking()
            .Where(x => x.IsActive && x.Factor > 0 && (x.MaterialCode == null || x.MaterialCode == "" || x.MaterialCode == material.Code)
                && ((x.FromUomCode == line && x.ToUomCode == material.UomCode) || (x.FromUomCode == material.UomCode && x.ToUomCode == line)))
            .ToListAsync(ct);
        var pick = candidates.OrderByDescending(x => x.MaterialCode == material.Code).FirstOrDefault()
            ?? throw new BusinessRuleException("stock.uomNotConvertible", line, material.UomCode, material.Code);
        return pick.FromUomCode == line ? pick.Factor : 1m / pick.Factor;
    }

    // ---- Unposting ---------------------------------------------------------------------------------------------------

    public Task UnpostAsync(int userId, string sourceFunction, long sourceId, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        var rows = await sql.QueryAsync<MovementRow>(ActiveRows, new { function = sourceFunction, id = sourceId }, token);
        if (rows.Count == 0) throw new BusinessRuleException("stock.notPosted");
        var allow = new Dictionary<string, bool>();
        foreach (var row in rows.OrderBy(x => x.MaterialCode, StringComparer.Ordinal).ThenBy(x => x.LotCode, StringComparer.Ordinal)
                     .ThenBy(x => x.LocationCode, StringComparer.Ordinal).ThenBy(x => x.Id))
        {
            if (!allow.TryGetValue(row.UnitCode, out var allowNegative))
                allow[row.UnitCode] = allowNegative = (await parameters.GetAsync(row.UnitCode, token)).AllowNegativeStock;
            var slot = new Slot(row.UnitCode, row.WarehouseCode, row.MaterialCode, row.LotCode ?? string.Empty, row.LocationCode ?? string.Empty);
            // The reversal takes back exactly what was booked, quantity and value.
            await ApplyAsync(slot, -row.Quantity, -row.Value, userId, allowNegative, row.UomCode, token);
            await sql.ExecuteAsync(InsertMovement, new
            {
                function = row.SourceFunction, sourceId = row.SourceId, sourceLineId = row.SourceLineId, unit = row.UnitCode,
                warehouse = row.WarehouseCode, material = row.MaterialCode, lot = row.LotCode, location = row.LocationCode,
                date = row.DocumentDate.ToDateTime(TimeOnly.MinValue), quantity = -row.Quantity, value = -row.Value, uom = row.UomCode, lineUom = row.LineUomCode,
                lineQuantity = row.LineQuantity is { } q ? -q : (decimal?)null, seq = row.PostingSeq, reversalOf = (long?)row.Id, user = userId
            }, token);
        }
    }, ct);

    // ---- Balances ----------------------------------------------------------------------------------------------------

    /// <summary>
    /// Moves the balances of one slot by a signed quantity: the warehouse balance (quantity and value), the lot balance when the
    /// slot has a lot and the location balance when it has a location. <paramref name="valueDelta"/> null = value it at the moving
    /// average (stock going out). Returns the value moved.
    /// </summary>
    private async Task<decimal> ApplyAsync(Slot slot, decimal quantity, decimal? valueDelta, int userId, bool allowNegative, string uom, CancellationToken ct)
    {
        var key = new { unit = slot.Unit, warehouse = slot.Warehouse, material = slot.Material };
        var current = await sql.QuerySingleOrDefaultAsync<BalanceRow>(LockWarehouseBalance, key, ct);
        var onHand = current?.Quantity ?? 0m;
        if (onHand + quantity < 0 && !allowNegative) throw Insufficient(slot, onHand, uom);
        var value = valueDelta ?? -StockMath.OutValue(-quantity, onHand, current?.Value ?? 0m);
        await sql.ExecuteAsync(UpsertWarehouseBalance, new { key.unit, key.warehouse, key.material, quantity, value, user = userId }, ct);

        if (slot.Lot.Length > 0)
        {
            var lot = await sql.QuerySingleOrDefaultAsync<BalanceRow>(LockLotBalance, new { key.unit, key.warehouse, key.material, lot = slot.Lot }, ct);
            if ((lot?.Quantity ?? 0m) + quantity < 0 && !allowNegative) throw Insufficient(slot, lot?.Quantity ?? 0m, uom);
            await sql.ExecuteAsync(UpsertLotBalance, new { key.unit, key.warehouse, key.material, lot = slot.Lot, quantity, user = userId }, ct);
        }
        if (slot.Location.Length > 0)
        {
            var location = await sql.QuerySingleOrDefaultAsync<BalanceRow>(LockLocationBalance,
                new { key.unit, key.warehouse, key.material, lot = slot.Lot, location = slot.Location }, ct);
            if ((location?.Quantity ?? 0m) + quantity < 0 && !allowNegative) throw Insufficient(slot, location?.Quantity ?? 0m, uom);
            await sql.ExecuteAsync(UpsertLocationBalance,
                new { key.unit, key.warehouse, key.material, lot = slot.Lot, location = slot.Location, quantity, user = userId }, ct);
        }
        return value;
    }

    private static BusinessRuleException Insufficient(Slot slot, decimal available, string uom) =>
        new("stock.insufficient", slot.Material, slot.Warehouse + (slot.Lot.Length > 0 ? " / " + slot.Lot : "") + (slot.Location.Length > 0 ? " / " + slot.Location : ""),
            available.ToString("0.####", CultureInfo.InvariantCulture), uom);

    // ---- Check and repair --------------------------------------------------------------------------------------------

    public async Task<IReadOnlyList<StockDiscrepancy>> VerifyAsync(string? unitCode, CancellationToken ct) =>
        (await sql.QueryAsync<DiscrepancyRow>(SqlScripts.Get(Module, "Verify"), new { unit = unitCode }, ct))
        .Select(x => new StockDiscrepancy(x.Level, x.UnitCode, x.WarehouseCode, x.MaterialCode, x.LotCode, x.LocationCode,
            x.LedgerQuantity, x.BalanceQuantity, x.LedgerValue, x.BalanceValue)).ToList();

    public Task<int> RebuildAsync(int userId, string? unitCode, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        await sql.ExecuteAsync(SqlScripts.Get(Module, "RebuildBalances"), new { unit = unitCode, user = userId }, token);
        return (int)await sql.ExecuteScalarAsync<long>(CountBalances, new { unit = unitCode }, token);
    }, ct);

    // ---- Statements --------------------------------------------------------------------------------------------------

    /// <summary>Ledger rows of the voucher that have not been reversed.</summary>
    private const string ActiveRows = """
        SELECT m.id, m.source_function, m.source_id, m.source_line_id, m.unit_code, m.warehouse_code, m.material_code, m.lot_code,
               m.location_code, m.document_date, m.quantity, m.value, m.uom_code, m.line_uom_code, m.line_quantity, m.posting_seq
        FROM erp_stock_movement m
        WHERE m.source_function = @function AND m.source_id = @id AND m.reversal_of_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM erp_stock_movement r WHERE r.reversal_of_id = m.id)
        """;

    private const string ActivePostingCount = """
        SELECT count(*) FROM erp_stock_movement m
        WHERE m.source_function = @function AND m.source_id = @id AND m.reversal_of_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM erp_stock_movement r WHERE r.reversal_of_id = m.id)
        """;

    private const string NextPostingSeq = """
        SELECT COALESCE(max(posting_seq), 0) + 1 FROM erp_stock_movement
        WHERE source_function = @function AND source_id = @id AND reversal_of_id IS NULL
        """;

    private const string InsertMovement = """
        INSERT INTO erp_stock_movement (source_function, source_id, source_line_id, unit_code, warehouse_code, material_code, lot_code,
            location_code, document_date, quantity, value, uom_code, line_uom_code, line_quantity, posting_seq, reversal_of_id, created_by)
        VALUES (@function, @sourceId, @sourceLineId, @unit, @warehouse, @material, @lot, @location, @date, @quantity, @value, @uom,
            @lineUom, @lineQuantity, @seq, @reversalOf, @user)
        """;

    private const string LockWarehouseBalance = """
        SELECT quantity, value FROM erp_stock_balance
        WHERE unit_code = @unit AND warehouse_code = @warehouse AND material_code = @material FOR UPDATE
        """;

    private const string UpsertWarehouseBalance = """
        INSERT INTO erp_stock_balance (unit_code, warehouse_code, material_code, quantity, value, created_by)
        VALUES (@unit, @warehouse, @material, @quantity, @value, @user)
        ON CONFLICT (unit_code, warehouse_code, material_code) DO UPDATE
        SET quantity = erp_stock_balance.quantity + EXCLUDED.quantity, value = erp_stock_balance.value + EXCLUDED.value,
            updated_at = now(), updated_by = @user
        """;

    private const string LockLotBalance = """
        SELECT quantity FROM erp_stock_lot_balance
        WHERE unit_code = @unit AND warehouse_code = @warehouse AND material_code = @material AND lot_code = @lot FOR UPDATE
        """;

    private const string UpsertLotBalance = """
        INSERT INTO erp_stock_lot_balance (unit_code, warehouse_code, material_code, lot_code, quantity, created_by)
        VALUES (@unit, @warehouse, @material, @lot, @quantity, @user)
        ON CONFLICT (unit_code, warehouse_code, material_code, lot_code) DO UPDATE
        SET quantity = erp_stock_lot_balance.quantity + EXCLUDED.quantity, updated_at = now(), updated_by = @user
        """;

    private const string LockLocationBalance = """
        SELECT quantity FROM erp_stock_location_balance
        WHERE unit_code = @unit AND warehouse_code = @warehouse AND material_code = @material AND lot_code = @lot
          AND location_code = @location FOR UPDATE
        """;

    private const string UpsertLocationBalance = """
        INSERT INTO erp_stock_location_balance (unit_code, warehouse_code, material_code, lot_code, location_code, quantity, created_by)
        VALUES (@unit, @warehouse, @material, @lot, @location, @quantity, @user)
        ON CONFLICT (unit_code, warehouse_code, material_code, lot_code, location_code) DO UPDATE
        SET quantity = erp_stock_location_balance.quantity + EXCLUDED.quantity, updated_at = now(), updated_by = @user
        """;

    private const string CountBalances = """
        SELECT (SELECT count(*) FROM erp_stock_balance WHERE (@unit::varchar IS NULL OR unit_code = @unit))
             + (SELECT count(*) FROM erp_stock_lot_balance WHERE (@unit::varchar IS NULL OR unit_code = @unit))
             + (SELECT count(*) FROM erp_stock_location_balance WHERE (@unit::varchar IS NULL OR unit_code = @unit))
        """;
}
