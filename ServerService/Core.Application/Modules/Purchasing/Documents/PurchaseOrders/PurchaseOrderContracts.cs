using Core.Application.Common.Export;
using Core.Application.Common.Paging;
namespace Core.Application.Modules.Purchasing.Documents.PurchaseOrders;

/// <summary>
/// ReceivedQuantity = what goods receipts (not cancelled) already receive of this line. PurchaseRequestCode = the number of the purchase
/// request the line carries out (empty when the line was bought without one).
/// </summary>
public sealed record PurchaseOrderLineDto(long Id, string MaterialCode, string MaterialName, string UomCode,
    decimal Quantity, decimal UnitPrice, decimal Amount, string? Note, decimal ReceivedQuantity,
    long? PurchaseRequestLineId = null, string? PurchaseRequestCode = null);

/// <summary>A line: the material and unit are codes of the catalogs; the name is taken from the material when saved.</summary>
public sealed record SavePurchaseOrderLine(string MaterialCode, string UomCode, decimal Quantity, decimal UnitPrice, string? Note,
    long? PurchaseRequestLineId = null);

/// <summary>SubTotal and TaxAmount are in the order's currency; TotalValue (sub total + tax) in the base currency.</summary>
public sealed record PurchaseOrderDto(long Id, string Code, DateOnly Date, DateOnly CreatedDate, DateOnly? DeliveryDate,
    string UnitCode, string UnitName, string WarehouseCode, string WarehouseName, string VoucherType,
    string SupplierCode, string? SupplierName, string? PaymentTerms, string CurrencyCode, decimal ExchangeRate,
    string? TaxRateCode, decimal TaxRate, decimal SubTotal, decimal TaxAmount, string? Note, string Status, decimal TotalValue,
    string? PurchaseRequestCode, string CreatedBy, string? ApprovedBy, IReadOnlyList<PurchaseOrderLineDto> Items, uint Version);

public sealed record SavePurchaseOrderRequest(DateOnly Date, DateOnly? DeliveryDate, string WarehouseCode, string VoucherType,
    string SupplierCode, string? PaymentTerms, string CurrencyCode, decimal ExchangeRate, string? TaxRateCode,
    string? Note, IReadOnlyList<SavePurchaseOrderLine> Items, uint? Version = null,
    /// <summary>Draft (default), Pending or Approved: the status to save at, as far as the user's rights reach (Posted does not exist for an order).</summary>
    string? TargetStatus = null);

public sealed record PurchaseOrderOption(string Code, string Name);
public sealed record PurchaseOrderTaxOption(string Code, string Name, decimal Rate);
public sealed record PurchaseOrderOptionsDto(IReadOnlyList<PurchaseOrderOption> Warehouses,
    IReadOnlyList<PurchaseOrderOption> Currencies, IReadOnlyList<PurchaseOrderOption> Suppliers,
    IReadOnlyList<PurchaseOrderTaxOption> TaxRates);

/// <summary>A line of an approved order that a goods receipt may still receive (RemainingQuantity &gt; 0).</summary>
public sealed record OpenPurchaseOrderLineDto(long LineId, string MaterialCode, string MaterialName, string UomCode,
    decimal OrderedQuantity, decimal ReceivedQuantity, decimal RemainingQuantity, decimal UnitPrice, string? Note);

/// <summary>An approved order with something left to receive: what "Lấy từ đơn mua hàng" of the goods receipt screen lists.</summary>
public sealed record OpenPurchaseOrderDto(long Id, string Code, DateOnly Date, DateOnly? DeliveryDate, string WarehouseCode,
    string WarehouseName, string VoucherType, string SupplierCode, string? SupplierName, string? PaymentTerms,
    string CurrencyCode, decimal ExchangeRate, string? Note, IReadOnlyList<OpenPurchaseOrderLineDto> Lines);

public interface IPurchaseOrderService
{
    /// <summary>One page of the vouchers of the unit the user may see (filters, search and sort of <see cref="VoucherListQuery"/>).</summary>
    Task<PagedResult<PurchaseOrderDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>The same list as an Excel file (all rows the filter leaves, not one page); needs the Export right.</summary>
    Task<ExportFile> ExportAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>Warehouses the company unit may use (shared ones included), the active currencies, suppliers and tax rates.</summary>
    Task<PurchaseOrderOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct);
    Task<PurchaseOrderDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct);
    Task<PurchaseOrderDto> CreateAsync(int userId, string unitCode, SavePurchaseOrderRequest request, CancellationToken ct);
    Task<PurchaseOrderDto> UpdateAsync(int userId, string unitCode, long id, SavePurchaseOrderRequest request, CancellationToken ct);
    /// <summary>submit, approve, cancel or withdraw (an order is never posted).</summary>
    Task<PurchaseOrderDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct);
    Task<PurchaseOrderDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct);
    Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct);

    /// <summary>
    /// Approved orders of the unit with something left to receive (for the goods receipt screen: needs the goods receipt View right,
    /// not the order's). Prices are 0 for a user without the goods receipt VIEW_PRICE right. <paramref name="exceptReceiptId"/> is the
    /// goods receipt being edited: what it already receives does not count as received, so the screen can show what it may still receive.
    /// </summary>
    Task<IReadOnlyList<OpenPurchaseOrderDto>> GetOpenAsync(int userId, string unitCode, long? exceptReceiptId, CancellationToken ct);
}
