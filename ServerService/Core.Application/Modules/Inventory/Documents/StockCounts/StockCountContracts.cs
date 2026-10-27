using Core.Application.Common.Export;
using Core.Application.Common.Paging;
namespace Core.Application.Modules.Inventory.Documents.StockCounts;

/// <summary>A line as the user sees it. Book quantity and difference are worked out by the server; the cost columns are 0 for a user without VIEW_COST.</summary>
public sealed record StockCountLineDto(long Id, string MaterialCode, string MaterialName, string UomCode, string? LotNumber, string? Position,
    decimal BookQuantity, decimal CountedQuantity, decimal DiffQuantity, decimal UnitCost, decimal DiffValue, string? Note);

/// <summary>
/// A line to save: the user types what was counted. <c>UnitCost</c> is only used to value a surplus of a material that has no
/// stock (so no average cost) in the warehouse at the counting date; otherwise the moving average of the warehouse is used.
/// </summary>
public sealed record SaveStockCountLine(string MaterialCode, string? LotNumber, string? Position, decimal CountedQuantity,
    decimal UnitCost = 0, string? Note = null);

public sealed record StockCountDto(long Id, string Code, DateOnly Date, DateOnly CreatedDate, string UnitCode, string UnitName,
    string WarehouseCode, string WarehouseName, string? CounterName, string? Reason, string? Note, string Status,
    decimal SurplusValue, decimal ShortageValue, decimal TotalValue, string CreatedBy, string? ApprovedBy,
    IReadOnlyList<StockCountLineDto> Items, uint Version);

public sealed record SaveStockCountRequest(DateOnly Date, string WarehouseCode, string? CounterName, string? Reason, string? Note,
    IReadOnlyList<SaveStockCountLine> Items, uint? Version = null,
    /// <summary>Draft (default), Pending, Approved or Posted: the status to save at, as far as the user's rights reach (VoucherTargetStatus).</summary>
    string? TargetStatus = null);

public sealed record StockCountOption(string Code, string Name);
public sealed record StockCountOptionsDto(IReadOnlyList<StockCountOption> Warehouses, IReadOnlyList<StockCountOption> MaterialGroups);

/// <summary>Filters of "Lấy tồn sổ sách": which materials of the warehouse to list.</summary>
/// <param name="IncludeZero">Also list materials whose book stock is 0 (default: only those with stock).</param>
/// <param name="CycleOnly">Only materials flagged for cycle counting.</param>
public sealed record StockCountBookQuery(string WarehouseCode, DateOnly? Date = null, string? Group = null, string? Search = null,
    bool IncludeZero = false, bool CycleOnly = false);

/// <summary>One line the count would start from: the book stock of a material (a lot / a location for tracked materials) at the date.</summary>
public sealed record StockCountBookLineDto(string MaterialCode, string MaterialName, string UomCode, string? LotNumber, string? Position,
    decimal BookQuantity, decimal UnitCost);

public interface IStockCountService
{
    /// <summary>One page of the counts of the unit the user may see (filters, search and sort of <see cref="VoucherListQuery"/>).</summary>
    Task<PagedResult<StockCountDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>The same list as an Excel file (all rows the filter leaves, not one page); needs the Export right.</summary>
    Task<ExportFile> ExportAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>Warehouses the company unit may use (shared ones included) and the material groups.</summary>
    Task<StockCountOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct);
    /// <summary>The book stock of a warehouse at a date from the ledger, to start a count from (needs the Create or Edit right).</summary>
    Task<IReadOnlyList<StockCountBookLineDto>> GetBookStockAsync(int userId, string unitCode, StockCountBookQuery query, CancellationToken ct);
    Task<StockCountDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct);
    Task<StockCountDto> CreateAsync(int userId, string unitCode, SaveStockCountRequest request, CancellationToken ct);
    Task<StockCountDto> UpdateAsync(int userId, string unitCode, long id, SaveStockCountRequest request, CancellationToken ct);
    Task<StockCountDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct);
    Task<StockCountDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct);
    Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct);
}
