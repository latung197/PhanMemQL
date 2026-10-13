using Core.Application.Common.Export;
using Core.Application.Common.Paging;
namespace Core.Application.Modules.Purchasing.Documents.PurchaseRequests;

/// <summary>OrderedQuantity = what purchase orders (not cancelled) already order of this line; the rest is still to be ordered.</summary>
public sealed record PurchaseRequestLineDto(long Id, string MaterialCode, string MaterialName, string UomCode,
    decimal Quantity, decimal UnitPrice, decimal Amount, string? Note, decimal OrderedQuantity);

/// <summary>A line: the material and unit are codes of the catalogs; the name is taken from the material when saved.</summary>
public sealed record SavePurchaseRequestLine(string MaterialCode, string UomCode, decimal Quantity, decimal UnitPrice, string? Note);

public sealed record PurchaseRequestDto(long Id, string Code, DateOnly Date, DateOnly CreatedDate, DateOnly? RequiredDate,
    string UnitCode, string UnitName, string WarehouseCode, string WarehouseName, string VoucherType,
    string? DepartmentCode, string? DepartmentName, string? RequesterName, string? SupplierCode, string? SupplierName,
    string CurrencyCode, decimal ExchangeRate, string? Note, string Status, decimal TotalValue, string CreatedBy,
    string? ApprovedBy, IReadOnlyList<PurchaseRequestLineDto> Items, uint Version, string? ProjectCode = null);

public sealed record SavePurchaseRequestRequest(DateOnly Date, DateOnly? RequiredDate, string WarehouseCode, string VoucherType,
    string? DepartmentCode, string? RequesterName, string? SupplierCode, string CurrencyCode, decimal ExchangeRate,
    string? Note, IReadOnlyList<SavePurchaseRequestLine> Items, uint? Version = null,
    /// <summary>Draft (default), Pending or Approved: the status to save at, as far as the user's rights reach (Posted does not exist for a request).</summary>
    string? TargetStatus = null,
    /// <summary>The project (dự án) of the voucher, optional; only a project that is in use and still takes vouchers.</summary>
    string? ProjectCode = null);

public sealed record PurchaseRequestOption(string Code, string Name);
public sealed record PurchaseRequestOptionsDto(IReadOnlyList<PurchaseRequestOption> Warehouses,
    IReadOnlyList<PurchaseRequestOption> Currencies, IReadOnlyList<PurchaseRequestOption> Departments,
    IReadOnlyList<PurchaseRequestOption> Suppliers);

/// <summary>A line of an approved request that a purchase order may still order (RemainingQuantity &gt; 0).</summary>
public sealed record OpenPurchaseRequestLineDto(long LineId, string MaterialCode, string MaterialName, string UomCode,
    decimal RequestedQuantity, decimal OrderedQuantity, decimal RemainingQuantity, decimal UnitPrice, string? Note);

/// <summary>An approved request with something left to order: what "Lấy từ phiếu yêu cầu mua hàng" of the purchase order screen lists.</summary>
public sealed record OpenPurchaseRequestDto(long Id, string Code, DateOnly Date, DateOnly? RequiredDate, string WarehouseCode,
    string WarehouseName, string VoucherType, string? DepartmentName, string? RequesterName, string? SupplierCode, string? SupplierName,
    string CurrencyCode, decimal ExchangeRate, string? Note, IReadOnlyList<OpenPurchaseRequestLineDto> Lines);

public interface IPurchaseRequestService
{
    /// <summary>One page of the vouchers of the unit the user may see (filters, search and sort of <see cref="VoucherListQuery"/>).</summary>
    Task<PagedResult<PurchaseRequestDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>The same list as an Excel file (all rows the filter leaves, not one page); needs the Export right.</summary>
    Task<ExportFile> ExportAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>Warehouses the company unit may use (shared ones included), the active currencies, departments and suppliers.</summary>
    Task<PurchaseRequestOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct);
    Task<PurchaseRequestDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct);
    Task<PurchaseRequestDto> CreateAsync(int userId, string unitCode, SavePurchaseRequestRequest request, CancellationToken ct);
    Task<PurchaseRequestDto> UpdateAsync(int userId, string unitCode, long id, SavePurchaseRequestRequest request, CancellationToken ct);
    /// <summary>submit, approve, cancel or withdraw (a request is never posted).</summary>
    Task<PurchaseRequestDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct);
    Task<PurchaseRequestDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct);
    Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct);

    /// <summary>
    /// Approved requests of the unit with something left to order (for the purchase order screen: needs the purchase order View right,
    /// not the request's). Prices are 0 for a user without the purchase order VIEW_PRICE right. <paramref name="exceptOrderId"/> is the
    /// purchase order being edited: what it already orders does not count as ordered, so the screen can show what it may still order.
    /// </summary>
    Task<IReadOnlyList<OpenPurchaseRequestDto>> GetOpenAsync(int userId, string unitCode, long? exceptOrderId, CancellationToken ct);
}
