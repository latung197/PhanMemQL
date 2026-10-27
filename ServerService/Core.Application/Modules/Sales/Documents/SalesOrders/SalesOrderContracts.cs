using Core.Application.Common.Export;
using Core.Application.Common.Paging;
namespace Core.Application.Modules.Sales.Documents.SalesOrders;

/// <summary>IssuedQuantity = what goods issues (not cancelled) already issue of this line.</summary>
public sealed record SalesOrderLineDto(long Id, string MaterialCode, string MaterialName, string UomCode,
    decimal Quantity, decimal UnitPrice, decimal Amount, string? Note, decimal IssuedQuantity);

/// <summary>A line: the material and unit are codes of the catalogs; the name is taken from the material when saved.</summary>
public sealed record SaveSalesOrderLine(string MaterialCode, string UomCode, decimal Quantity, decimal UnitPrice, string? Note);

/// <summary>SubTotal and TaxAmount are in the order currency; TotalValue (sub total + tax) in the base currency.</summary>
public sealed record SalesOrderDto(long Id, string Code, DateOnly Date, DateOnly CreatedDate, DateOnly? DeliveryDate,
    string UnitCode, string UnitName, string WarehouseCode, string WarehouseName, string VoucherType,
    string CustomerCode, string? CustomerName, string? DeliveryAddress, string? PaymentTerms, string CurrencyCode, decimal ExchangeRate,
    string? TaxRateCode, decimal TaxRate, decimal SubTotal, decimal TaxAmount, string? Note, string Status, decimal TotalValue,
    string CreatedBy, string? ApprovedBy, IReadOnlyList<SalesOrderLineDto> Items, uint Version, string? ProjectCode = null, string? PaymentTermCode = null);

public sealed record SaveSalesOrderRequest(DateOnly Date, DateOnly? DeliveryDate, string WarehouseCode, string VoucherType,
    string CustomerCode, string? DeliveryAddress, string CurrencyCode, decimal ExchangeRate, string? TaxRateCode,
    string? Note, IReadOnlyList<SaveSalesOrderLine> Items, uint? Version = null,
    /// <summary>Draft (default), Pending or Approved: the status to save at, as far as the rights of the user reach (Posted does not exist for an order).</summary>
    string? TargetStatus = null,
    string? ProjectCode = null,
    /// <summary>A payment term of the catalog (optional): its name is kept on the order.</summary>
    string? PaymentTermCode = null, string? PaymentTerms = null);

public sealed record SalesOrderOption(string Code, string Name);
public sealed record SalesOrderTaxOption(string Code, string Name, decimal Rate);
public sealed record SalesOrderOptionsDto(IReadOnlyList<SalesOrderOption> Warehouses, IReadOnlyList<SalesOrderOption> Currencies,
    IReadOnlyList<SalesOrderTaxOption> TaxRates);

/// <summary>A line of an approved order that a goods issue may still deliver (RemainingQuantity &gt; 0).</summary>
public sealed record OpenSalesOrderLineDto(long LineId, string MaterialCode, string MaterialName, string UomCode,
    decimal OrderedQuantity, decimal IssuedQuantity, decimal RemainingQuantity, decimal UnitPrice, string? Note);

/// <summary>An approved order with something left to deliver: what "Lấy từ đơn bán hàng" of the goods issue screen lists.</summary>
public sealed record OpenSalesOrderDto(long Id, string Code, DateOnly Date, DateOnly? DeliveryDate, string WarehouseCode,
    string WarehouseName, string VoucherType, string CustomerCode, string? CustomerName, string? DeliveryAddress,
    string CurrencyCode, decimal ExchangeRate, string? Note, IReadOnlyList<OpenSalesOrderLineDto> Lines, string? ProjectCode = null);

public interface ISalesOrderService
{
    /// <summary>One page of the vouchers of the unit the user may see (filters, search and sort of <see cref="VoucherListQuery"/>).</summary>
    Task<PagedResult<SalesOrderDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>The same list as an Excel file (all rows the filter leaves, not one page); needs the Export right.</summary>
    Task<ExportFile> ExportAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>Warehouses the company unit may use (shared ones included), the active currencies and tax rates.</summary>
    Task<SalesOrderOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct);
    Task<SalesOrderDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct);
    Task<SalesOrderDto> CreateAsync(int userId, string unitCode, SaveSalesOrderRequest request, CancellationToken ct);
    Task<SalesOrderDto> UpdateAsync(int userId, string unitCode, long id, SaveSalesOrderRequest request, CancellationToken ct);
    /// <summary>submit, approve, cancel, reopen or withdraw (an order is never posted).</summary>
    Task<SalesOrderDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct);
    Task<SalesOrderDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct);
    Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct);

    /// <summary>
    /// Approved orders of the unit with something left to deliver (for the goods issue screen: needs the goods issue View right, not the
    /// order's). Prices are 0 for a user without the goods issue VIEW_PRICE right. <paramref name="exceptIssueId"/> is the goods issue
    /// being edited: what it already issues does not count as issued, so the screen can show what it may still issue.
    /// </summary>
    Task<IReadOnlyList<OpenSalesOrderDto>> GetOpenAsync(int userId, string unitCode, long? exceptIssueId, CancellationToken ct);
}
