using Core.Application.Common.Export;
using Core.Application.Common.Paging;
namespace Core.Application.Modules.Purchasing.Documents.PurchaseInvoices;

/// <summary>
/// A line of an invoice. PurchaseOrderLineId / GoodsReceiptLineId = the lines it bills (empty for a line without that source);
/// the numbers of those vouchers are shown on the line.
/// </summary>
public sealed record PurchaseInvoiceLineDto(long Id, string MaterialCode, string MaterialName, string UomCode,
    decimal Quantity, decimal UnitPrice, decimal Amount, string? Note,
    long? PurchaseOrderLineId = null, string? PurchaseOrderCode = null, long? GoodsReceiptLineId = null, string? GoodsReceiptCode = null);

/// <summary>
/// A line: the material and unit are codes of the catalogs; the name is taken from the material when saved. Giving
/// GoodsReceiptLineId is enough: the order line is then the one the receipt line follows (the server sets it).
/// </summary>
public sealed record SavePurchaseInvoiceLine(string MaterialCode, string UomCode, decimal Quantity, decimal UnitPrice, string? Note,
    long? PurchaseOrderLineId = null, long? GoodsReceiptLineId = null);

/// <summary>SubTotal and TaxAmount are in the invoice's currency; TotalValue (sub total + tax) in the base currency.</summary>
public sealed record PurchaseInvoiceDto(long Id, string Code, DateOnly Date, DateOnly CreatedDate, string UnitCode, string UnitName,
    string VoucherType, string SupplierCode, string? SupplierName, string InvoiceNo, string? InvoiceSeries, DateOnly InvoiceDate,
    DateOnly DueDate, string? PaymentTerms, string CurrencyCode, decimal ExchangeRate, string? TaxRateCode, decimal TaxRate,
    decimal SubTotal, decimal TaxAmount, string? Note, string Status, decimal TotalValue, string? PurchaseOrderCode, string? GoodsReceiptCode,
    string CreatedBy, string? ApprovedBy, IReadOnlyList<PurchaseInvoiceLineDto> Items, uint Version, string? ProjectCode = null, string? PaymentTermCode = null);

public sealed record SavePurchaseInvoiceRequest(DateOnly Date, string VoucherType, string SupplierCode, string InvoiceNo, string? InvoiceSeries,
    DateOnly InvoiceDate, DateOnly? DueDate, string CurrencyCode, decimal ExchangeRate, string? TaxRateCode, string? Note,
    IReadOnlyList<SavePurchaseInvoiceLine> Items, uint? Version = null,
    /// <summary>Draft (default), Pending or Approved: the status to save at, as far as the user's rights reach (Posted does not exist for an invoice).</summary>
    string? TargetStatus = null,
    string? ProjectCode = null,
    /// <summary>A payment term of the catalog (optional): it gives the due date (invoice date + its days) when DueDate is empty.</summary>
    string? PaymentTermCode = null, string? PaymentTerms = null);

public sealed record PurchaseInvoiceOption(string Code, string Name);
public sealed record PurchaseInvoiceTaxOption(string Code, string Name, decimal Rate);
public sealed record PurchaseInvoiceOptionsDto(IReadOnlyList<PurchaseInvoiceOption> Currencies, IReadOnlyList<PurchaseInvoiceOption> Suppliers,
    IReadOnlyList<PurchaseInvoiceTaxOption> TaxRates);

/// <summary>A line of an approved or posted goods receipt that an invoice may still bill (RemainingQuantity &gt; 0).</summary>
public sealed record OpenInvoiceReceiptLineDto(long LineId, string MaterialCode, string MaterialName, string UomCode,
    decimal ReceivedQuantity, decimal InvoicedQuantity, decimal RemainingQuantity, decimal UnitPrice, string? Note,
    long? PurchaseOrderLineId = null, string? PurchaseOrderCode = null);

/// <summary>A goods receipt of a supplier with something left to bill: what "Lấy từ phiếu nhập kho" of the invoice screen lists.</summary>
public sealed record OpenInvoiceReceiptDto(long Id, string Code, DateOnly Date, string WarehouseCode, string WarehouseName,
    string SupplierCode, string? SupplierName, string CurrencyCode, decimal ExchangeRate, string? Note,
    IReadOnlyList<OpenInvoiceReceiptLineDto> Lines, string? ProjectCode = null, string? TaxRateCode = null, string? PaymentTermCode = null);

/// <summary>A line of an approved order that an invoice may still bill (RemainingQuantity = ordered - invoiced &gt; 0).</summary>
public sealed record OpenInvoiceOrderLineDto(long LineId, string MaterialCode, string MaterialName, string UomCode,
    decimal OrderedQuantity, decimal ReceivedQuantity, decimal InvoicedQuantity, decimal RemainingQuantity, decimal UnitPrice, string? Note);

/// <summary>An approved order of a supplier with something left to bill: what "Lấy từ đơn mua hàng" of the invoice screen lists.</summary>
public sealed record OpenInvoiceOrderDto(long Id, string Code, DateOnly Date, string SupplierCode, string? SupplierName,
    string CurrencyCode, decimal ExchangeRate, string? TaxRateCode, string? PaymentTermCode, string? PaymentTerms, string? Note,
    IReadOnlyList<OpenInvoiceOrderLineDto> Lines, string? ProjectCode = null);

public interface IPurchaseInvoiceService
{
    /// <summary>One page of the vouchers of the unit the user may see (filters, search and sort of <see cref="VoucherListQuery"/>).</summary>
    Task<PagedResult<PurchaseInvoiceDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>The same list as an Excel file (all rows the filter leaves, not one page); needs the Export right.</summary>
    Task<ExportFile> ExportAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>The active currencies, suppliers and tax rates.</summary>
    Task<PurchaseInvoiceOptionsDto> GetOptionsAsync(CancellationToken ct);
    Task<PurchaseInvoiceDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct);
    Task<PurchaseInvoiceDto> CreateAsync(int userId, string unitCode, SavePurchaseInvoiceRequest request, CancellationToken ct);
    Task<PurchaseInvoiceDto> UpdateAsync(int userId, string unitCode, long id, SavePurchaseInvoiceRequest request, CancellationToken ct);
    /// <summary>submit, approve, cancel, reopen or withdraw (an invoice is never posted).</summary>
    Task<PurchaseInvoiceDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct);
    Task<PurchaseInvoiceDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct);
    Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct);

    /// <summary>
    /// Goods receipts (approved or posted) of the unit and the supplier with something left to bill. <paramref name="exceptInvoiceId"/> is
    /// the invoice being edited: what it already bills does not count, so the screen shows what it may still bill. Prices are 0 for a user
    /// without the invoice VIEW_PRICE right.
    /// </summary>
    Task<IReadOnlyList<OpenInvoiceReceiptDto>> GetOpenReceiptsAsync(int userId, string unitCode, string? supplier, long? exceptInvoiceId, CancellationToken ct);
    /// <summary>Approved orders of the unit and the supplier with something left to bill (see <see cref="GetOpenReceiptsAsync"/>).</summary>
    Task<IReadOnlyList<OpenInvoiceOrderDto>> GetOpenOrdersAsync(int userId, string unitCode, string? supplier, long? exceptInvoiceId, CancellationToken ct);
}
