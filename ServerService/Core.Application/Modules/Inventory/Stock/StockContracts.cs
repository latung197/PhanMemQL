using Core.Application.Common.Paging;

namespace Core.Application.Modules.Inventory.Stock;

public enum StockDirection { In, Out }

/// <summary>
/// One voucher line to post to the stock ledger. <c>Quantity</c> is positive, in <c>UomCode</c> (empty = the base unit of
/// the material); the ledger converts it to the base unit. <c>Value</c> is the line value in the base currency and is only
/// used for stock coming in; stock going out is valued at the moving average of the warehouse.
/// </summary>
/// <param name="LotNo">Lot number: required for a material tracked by lot, refused for any other. A lot that does not exist is
/// created on stock coming in (with <c>LotMfgDate</c> / <c>LotExpDate</c>); stock going out needs an existing, released, unexpired lot.</param>
/// <param name="LocationCode">Storage location: required for a material tracked by location, refused for any other; it must
/// belong to the warehouse of the posting.</param>
public sealed record StockLineInput(long SourceLineId, string MaterialCode, decimal Quantity, string? UomCode, decimal Value,
    string? LotNo = null, DateOnly? LotMfgDate = null, DateOnly? LotExpDate = null, string? LocationCode = null);

/// <summary>A voucher to post: all its lines go in one direction, into or out of one warehouse of one company unit.</summary>
public sealed record StockPosting(string SourceFunction, long SourceId, string UnitCode, string WarehouseCode, DateOnly Date,
    StockDirection Direction, IReadOnlyList<StockLineInput> Lines);

/// <summary>A difference between the ledger and a balance table (<c>Level</c> is warehouse, lot or location).</summary>
public sealed record StockDiscrepancy(string Level, string UnitCode, string WarehouseCode, string MaterialCode, string LotCode,
    string LocationCode, decimal LedgerQuantity, decimal BalanceQuantity, decimal LedgerValue, decimal BalanceValue);

/// <summary>
/// The stock ledger (sổ kho): the one place every voucher that moves stock posts to. Posting writes the ledger rows and
/// updates the three balance tables (by warehouse, lot and location) in the same transaction, so the balances always equal
/// the sum of the ledger. Every method joins the transaction of the caller (IUnitOfWork) or starts its own.
/// </summary>
public interface IStockLedger
{
    /// <summary>
    /// Posts a voucher. Refused when the voucher is already posted, the warehouse or a material cannot take stock, the lot /
    /// location rules are broken, a unit cannot be converted, or stock would go negative (unless the unit allows negative stock).
    /// </summary>
    Task PostAsync(int userId, StockPosting posting, CancellationToken ct);

    /// <summary>Reverses the active posting of a voucher with reversal rows (nothing is deleted). Refused when stock would go negative.</summary>
    Task UnpostAsync(int userId, string sourceFunction, long sourceId, CancellationToken ct);

    /// <summary>Differences between the ledger and the balance tables (none when all is well); all units when <paramref name="unitCode"/> is null.</summary>
    Task<IReadOnlyList<StockDiscrepancy>> VerifyAsync(string? unitCode, CancellationToken ct);

    /// <summary>Rebuilds the balance tables from the ledger (after a repair). Returns the number of balance rows written.</summary>
    Task<int> RebuildAsync(int userId, string? unitCode, CancellationToken ct);
}

/// <param name="Level">warehouse, lot or location: how fine the balances are cut.</param>
public sealed record StockBalanceQuery(string Level = "warehouse", string? WarehouseCode = null, string? MaterialCode = null,
    string? LotCode = null, string? LocationCode = null, bool IncludeZero = false, string? Search = null, int Page = 1, int PageSize = 50);

/// <param name="Value">Null when the caller may not see costs.</param>
public sealed record StockBalanceDto(string UnitCode, string WarehouseCode, string? WarehouseName, string MaterialCode, string? MaterialName,
    string? UomCode, string LotCode, string? LotNo, DateOnly? ExpDate, string LocationCode, decimal Quantity, decimal? Value);

public sealed record StockMovementQuery(string? WarehouseCode = null, string? MaterialCode = null, string? LotCode = null,
    string? LocationCode = null, DateOnly? From = null, DateOnly? To = null, string? SourceFunction = null, long? SourceId = null,
    int Page = 1, int PageSize = 50);

public sealed record StockMovementDto(long Id, string SourceFunction, long SourceId, long SourceLineId, string UnitCode,
    string WarehouseCode, string MaterialCode, string? MaterialName, string? LotCode, string? LocationCode, DateOnly DocumentDate,
    decimal Quantity, decimal? Value, string UomCode, string? LineUomCode, decimal? LineQuantity, int PostingSeq, long? ReversalOfId,
    DateTime CreatedAt);

/// <summary>Reading the stock: balances at warehouse, lot or location level and the ledger rows behind them.</summary>
public interface IStockQuery
{
    Task<PagedResult<StockBalanceDto>> GetBalancesAsync(string unitCode, StockBalanceQuery query, bool canSeeCost, CancellationToken ct);
    Task<PagedResult<StockMovementDto>> GetMovementsAsync(string unitCode, StockMovementQuery query, bool canSeeCost, CancellationToken ct);
}

/// <summary>The money and unit arithmetic of the ledger, apart from the database so it can be tested on its own.</summary>
public static class StockMath
{
    /// <summary>The quantity in the base unit: <c>quantity × factor</c> (factor = base units in one line unit), to 4 decimals.</summary>
    public static decimal ToBaseQuantity(decimal quantity, decimal factor) => decimal.Round(quantity * factor, 4);

    /// <summary>
    /// The value of <paramref name="outQuantity"/> leaving a stock of <paramref name="onHandQuantity"/> worth
    /// <paramref name="onHandValue"/>, at their moving average. Taking all of the stock (or more) takes all the value, so no
    /// rounding remainder stays behind; stock that is empty or negative carries no value.
    /// </summary>
    public static decimal OutValue(decimal outQuantity, decimal onHandQuantity, decimal onHandValue)
    {
        if (outQuantity <= 0 || onHandQuantity <= 0) return 0;
        if (outQuantity >= onHandQuantity) return onHandValue;
        return decimal.Round(onHandValue * outQuantity / onHandQuantity, 2);
    }
}
