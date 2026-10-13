using Core.Application.Common.Export;
using Core.Application.Common.Paging;
namespace Core.Application.Modules.Inventory.Documents.GoodsIssues;

public sealed record GoodsIssueLineDto(long Id, string Kind, string MaterialCode, string MaterialName,
    string UomCode, decimal Quantity, decimal UnitPrice, decimal Amount, string? LotNumber, string? Position, long? IssueRequestLineId = null,
    string? IssueRequestCode = null);

/// <summary>A line: the material and unit are codes of the catalogs; the name is taken from the material when saved.</summary>
public sealed record SaveGoodsIssueLine(string Kind, string MaterialCode,
    string UomCode, decimal Quantity, decimal UnitPrice, string? LotNumber, string? Position, long? IssueRequestLineId = null);

public sealed record GoodsIssueDto(long Id, string Code, DateOnly Date, DateOnly CreatedDate,
    string UnitCode, string UnitName, string WarehouseCode, string WarehouseName, string VoucherType,
    string CurrencyCode, decimal ExchangeRate, string? CustomerName, string? ReceiverName, string? IssueRequestCode,
    string? Note, string Status, decimal TotalValue, string CreatedBy, string? ApprovedBy,
    IReadOnlyList<GoodsIssueLineDto> Items, IReadOnlyList<GoodsIssueLineDto> MaterialItems, uint Version, string? ProjectCode = null);

public sealed record SaveGoodsIssueRequest(DateOnly Date, string WarehouseCode, string VoucherType,
    string CurrencyCode, decimal ExchangeRate, string? CustomerName, string? ReceiverName,
    string? Note, IReadOnlyList<SaveGoodsIssueLine> Items,
    IReadOnlyList<SaveGoodsIssueLine>? MaterialItems, uint? Version = null,
    /// <summary>Draft (default), Pending, Approved or Posted: the status to save at, as far as the user's rights reach (VoucherTargetStatus).</summary>
    string? TargetStatus = null,
    /// <summary>The approved issue request (phiếu yêu cầu xuất kho) this issue carries out; every item line then names the request line it carries out.</summary>
    string? IssueRequestCode = null,
    /// <summary>The project (dự án) of the voucher, optional; only a project that is in use and still takes vouchers.</summary>
    string? ProjectCode = null);

public sealed record GoodsIssueOption(string Code, string Name);
public sealed record GoodsIssueOptionsDto(IReadOnlyList<GoodsIssueOption> Warehouses,
    IReadOnlyList<GoodsIssueOption> Currencies);

public interface IGoodsIssueService
{
    /// <summary>One page of the vouchers of the unit the user may see (filters, search and sort of <see cref="VoucherListQuery"/>).</summary>
    Task<PagedResult<GoodsIssueDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>The same list as an Excel file (all rows the filter leaves, not one page); needs the Export right.</summary>
    Task<ExportFile> ExportAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>Warehouses the company unit may use (shared ones included) and the active currencies.</summary>
    Task<GoodsIssueOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct);
    Task<GoodsIssueDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct);
    Task<GoodsIssueDto> CreateAsync(int userId, string unitCode, SaveGoodsIssueRequest request, CancellationToken ct);
    Task<GoodsIssueDto> UpdateAsync(int userId, string unitCode, long id, SaveGoodsIssueRequest request, CancellationToken ct);
    Task<GoodsIssueDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct);
    Task<GoodsIssueDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct);
    Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct);
}
