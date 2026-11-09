using Core.Application.Common.Export;

namespace Core.Application.Modules.Inventory.Reports;

// Kho › báo cáo (inv_report_stock, inv_report_nxt, inv_report_inward, inv_report_outward, inv_report_aging): every figure is read from the
// stock ledger (erp_stock_movement) of the company unit of the request, in the base unit of the material. Values are in the base
// currency and are null for a user without the VIEW_COST right of the report.

/// <summary>Tồn kho tại một ngày. AsOf default = today. IncludeZero also lists the materials whose stock is 0.</summary>
public sealed record StockReportQuery(DateOnly? AsOf = null, string? Warehouse = null, string? Group = null, string? Search = null, bool IncludeZero = false);

/// <summary>Nhập xuất tồn của một kỳ [From, To] (default: the month of today).</summary>
public sealed record NxtReportQuery(DateOnly? From = null, DateOnly? To = null, string? Warehouse = null, string? Group = null, string? Search = null, bool IncludeZero = false);

/// <summary>Bảng kê hàng nhập hoặc hàng xuất của một kỳ. Mode = detail (one row per stock line) or summary (one row per warehouse + material).</summary>
public sealed record MovementReportQuery(DateOnly? From = null, DateOnly? To = null, string? Warehouse = null, string? Group = null, string? Search = null, string Mode = "detail");

/// <summary>Giá trung bình tháng của một tháng (default: the month of today); Month 1-12.</summary>
public sealed record MonthlyCostQuery(int? Year = null, int? Month = null, string? Warehouse = null, string? Group = null, string? Search = null, bool IncludeZero = false);

/// <summary>Tồn kho tức thời: the stock on hand now against what approved requests and orders have set aside. IncludeZero also lists stock of 0.</summary>
public sealed record AvailabilityQuery(string? Warehouse = null, string? Group = null, string? Search = null, bool IncludeZero = false);

/// <summary>Tuổi hàng tồn tại một ngày (default today).</summary>
public sealed record AgingReportQuery(DateOnly? AsOf = null, string? Warehouse = null, string? Group = null, string? Search = null);

/// <param name="Level">below (under the minimum stock of the material), over (above the maximum), ok, or none (no limits declared).</param>
public sealed record StockReportRowDto(string WarehouseCode, string? WarehouseName, string MaterialCode, string MaterialName, string UomCode,
    string? GroupCode, decimal Quantity, decimal? Value, decimal? AverageCost, decimal? MinStock, decimal? MaxStock, string Level);

public sealed record NxtRowDto(string WarehouseCode, string? WarehouseName, string MaterialCode, string MaterialName, string UomCode,
    decimal OpeningQuantity, decimal InQuantity, decimal OutQuantity, decimal ClosingQuantity,
    decimal? OpeningValue, decimal? InValue, decimal? OutValue, decimal? ClosingValue);

/// <summary>One stock line of a voucher that brought goods in or took them out (quantity and value are positive).</summary>
public sealed record MovementDetailRowDto(DateOnly Date, string SourceFunction, string? VoucherCode, string? VoucherType, string? Partner,
    string WarehouseCode, string? WarehouseName, string MaterialCode, string MaterialName, string UomCode, string? LotCode,
    decimal Quantity, decimal? Value, decimal? UnitPrice);

public sealed record MovementSummaryRowDto(string WarehouseCode, string? WarehouseName, string MaterialCode, string MaterialName, string UomCode,
    int VoucherCount, decimal Quantity, decimal? Value);

/// <summary>Only the part that matches the mode of the query is filled.</summary>
public sealed record MovementReportDto(string Mode, IReadOnlyList<MovementDetailRowDto> Detail, IReadOnlyList<MovementSummaryRowDto> Summary);

/// <summary>
/// The stock of a material in a warehouse split by how long ago it came in: 0-30, 31-60, 61-90, 91-180 and over 180 days. The stock is
/// taken to be the newest receipts (the oldest goods leave first); the value of each part is its share of the stock value of the ledger (the
/// moving average of the warehouse), so the parts add up to the stock value.
/// </summary>
public sealed record AgingRowDto(string WarehouseCode, string? WarehouseName, string MaterialCode, string MaterialName, string UomCode, decimal Quantity,
    decimal Qty0To30, decimal Qty31To60, decimal Qty61To90, decimal Qty91To180, decimal QtyOver180,
    decimal? Value, decimal? Value0To30, decimal? Value31To60, decimal? Value61To90, decimal? Value91To180, decimal? ValueOver180);

/// <summary>
/// The monthly weighted average cost of a material in a warehouse: (opening value + value in) / (opening quantity + quantity in).
/// <c>ClosingCost</c> is the moving average the ledger holds at the end of the month, shown next to it for comparison. View only:
/// posted vouchers are never repriced.
/// </summary>
public sealed record MonthlyCostRowDto(string WarehouseCode, string? WarehouseName, string MaterialCode, string MaterialName, string UomCode,
    decimal OpeningQuantity, decimal? OpeningValue, decimal InQuantity, decimal? InValue, decimal OutQuantity, decimal? OutValue,
    decimal ClosingQuantity, decimal? ClosingValue, decimal? MonthAverageCost, decimal? ClosingCost);

/// <summary>
/// Stock on hand in the base unit of the material, the part set aside (not issued yet) by approved goods issue requests and by approved sales
/// orders of the warehouse, and what is left to promise: <c>Available = Quantity - ReservedByRequests - ReservedByOrders</c> (negative when more
/// was promised than is in stock). Quantities only, so no cost right is involved.
/// </summary>
public sealed record AvailabilityRowDto(string WarehouseCode, string? WarehouseName, string MaterialCode, string MaterialName, string UomCode,
    string? GroupCode, decimal Quantity, decimal ReservedByRequests, decimal ReservedByOrders, decimal Available);

public interface IStockReports
{
    Task<IReadOnlyList<StockReportRowDto>> GetStockAsync(string unitCode, StockReportQuery query, bool canSeeCost, CancellationToken ct);
    Task<IReadOnlyList<NxtRowDto>> GetNxtAsync(string unitCode, NxtReportQuery query, bool canSeeCost, CancellationToken ct);
    /// <param name="inward">true = goods in (the inward report), false = goods out (the outward report).</param>
    Task<MovementReportDto> GetMovementAsync(string unitCode, bool inward, MovementReportQuery query, bool canSeeCost, CancellationToken ct);
    Task<IReadOnlyList<AgingRowDto>> GetAgingAsync(string unitCode, AgingReportQuery query, bool canSeeCost, CancellationToken ct);
    Task<IReadOnlyList<AvailabilityRowDto>> GetAvailabilityAsync(string unitCode, AvailabilityQuery query, CancellationToken ct);
    Task<IReadOnlyList<MonthlyCostRowDto>> GetMonthlyCostAsync(string unitCode, MonthlyCostQuery query, bool canSeeCost, CancellationToken ct);

    /// <summary>The same reports as an Excel file (needs the Export right; logged in the change log).</summary>
    Task<ExportFile> ExportStockAsync(int userId, string unitCode, StockReportQuery query, bool canSeeCost, CancellationToken ct);
    Task<ExportFile> ExportNxtAsync(int userId, string unitCode, NxtReportQuery query, bool canSeeCost, CancellationToken ct);
    Task<ExportFile> ExportMovementAsync(int userId, string unitCode, bool inward, MovementReportQuery query, bool canSeeCost, CancellationToken ct);
    Task<ExportFile> ExportAgingAsync(int userId, string unitCode, AgingReportQuery query, bool canSeeCost, CancellationToken ct);
    Task<ExportFile> ExportAvailabilityAsync(int userId, string unitCode, AvailabilityQuery query, CancellationToken ct);
    Task<ExportFile> ExportMonthlyCostAsync(int userId, string unitCode, MonthlyCostQuery query, bool canSeeCost, CancellationToken ct);
}
