using Core.Application.Common.Export;
using Core.Application.Common.Paging;
namespace Core.Application.Modules.Inventory.Documents.IssueRequests;

/// <summary>IssuedQuantity = what goods issues (not cancelled) already carry out of this line; the rest is still to be issued.</summary>
public sealed record IssueRequestLineDto(long Id, string MaterialCode, string MaterialName, string UomCode,
    decimal Quantity, decimal UnitPrice, decimal Amount, string? Note, decimal IssuedQuantity);

/// <summary>A line: the material and unit are codes of the catalogs; the name is taken from the material when saved.</summary>
public sealed record SaveIssueRequestLine(string MaterialCode, string UomCode, decimal Quantity, decimal UnitPrice, string? Note);

public sealed record IssueRequestDto(long Id, string Code, DateOnly Date, DateOnly CreatedDate, DateOnly? RequiredDate,
    string UnitCode, string UnitName, string WarehouseCode, string WarehouseName, string VoucherType,
    string? DepartmentCode, string? DepartmentName, string? RequesterName, string? CustomerName,
    string CurrencyCode, decimal ExchangeRate, string? Note, string Status, decimal TotalValue, string CreatedBy,
    string? ApprovedBy, IReadOnlyList<IssueRequestLineDto> Items, uint Version, string? ProjectCode = null);

public sealed record SaveIssueRequestRequest(DateOnly Date, DateOnly? RequiredDate, string WarehouseCode, string VoucherType,
    string? DepartmentCode, string? RequesterName, string? CustomerName, string CurrencyCode, decimal ExchangeRate,
    string? Note, IReadOnlyList<SaveIssueRequestLine> Items, uint? Version = null,
    /// <summary>Draft (default), Pending or Approved: the status to save at, as far as the user's rights reach (Posted does not exist for a request).</summary>
    string? TargetStatus = null,
    /// <summary>The project (dự án) of the voucher, optional; only a project that is in use and still takes vouchers.</summary>
    string? ProjectCode = null);

public sealed record IssueRequestOption(string Code, string Name);
public sealed record IssueRequestOptionsDto(IReadOnlyList<IssueRequestOption> Warehouses,
    IReadOnlyList<IssueRequestOption> Currencies, IReadOnlyList<IssueRequestOption> Departments);

/// <summary>A line of an approved request that a goods issue may still carry out (RemainingQuantity &gt; 0).</summary>
public sealed record OpenIssueRequestLineDto(long LineId, string MaterialCode, string MaterialName, string UomCode,
    decimal RequestedQuantity, decimal IssuedQuantity, decimal RemainingQuantity, decimal UnitPrice, string? Note);

/// <summary>An approved request with something left to issue: what "Lấy từ phiếu yêu cầu" of the goods issue screen lists.</summary>
public sealed record OpenIssueRequestDto(long Id, string Code, DateOnly Date, DateOnly? RequiredDate, string WarehouseCode,
    string WarehouseName, string VoucherType, string? DepartmentName, string? RequesterName, string? CustomerName,
    string CurrencyCode, decimal ExchangeRate, string? Note, IReadOnlyList<OpenIssueRequestLineDto> Lines);

public interface IIssueRequestService
{
    /// <summary>One page of the vouchers of the unit the user may see (filters, search and sort of <see cref="VoucherListQuery"/>).</summary>
    Task<PagedResult<IssueRequestDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>The same list as an Excel file (all rows the filter leaves, not one page); needs the Export right.</summary>
    Task<ExportFile> ExportAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>Warehouses the company unit may use (shared ones included), the active currencies and departments.</summary>
    Task<IssueRequestOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct);
    Task<IssueRequestDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct);
    Task<IssueRequestDto> CreateAsync(int userId, string unitCode, SaveIssueRequestRequest request, CancellationToken ct);
    Task<IssueRequestDto> UpdateAsync(int userId, string unitCode, long id, SaveIssueRequestRequest request, CancellationToken ct);
    /// <summary>submit, approve, cancel or withdraw (a request is never posted).</summary>
    Task<IssueRequestDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct);
    Task<IssueRequestDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct);
    Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct);

    /// <summary>
    /// Approved requests of the unit with something left to issue (for the goods issue screen: needs the goods issue View right,
    /// not the request's). Prices are 0 for a user without the goods issue VIEW_PRICE right. <paramref name="exceptIssueId"/> is the
    /// goods issue being edited: what it already takes does not count as issued, so the screen can show what it may still take.
    /// </summary>
    Task<IReadOnlyList<OpenIssueRequestDto>> GetOpenAsync(int userId, string unitCode, long? exceptIssueId, CancellationToken ct);
}
