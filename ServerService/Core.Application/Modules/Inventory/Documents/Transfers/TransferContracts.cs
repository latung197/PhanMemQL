using Core.Application.Common.Export;
using Core.Application.Common.Paging;
namespace Core.Application.Modules.Inventory.Documents.Transfers;

// Điều chuyển kho: the three vouchers (lệnh điều chuyển, phiếu xuất điều chuyển, phiếu nhập điều chuyển) share these shapes.

/// <summary>
/// A line. DoneQuantity = what the later vouchers (not cancelled) already took: on an order what the issues transfer, on an issue
/// what the receipts receive. Prices (value of the goods, base currency) are 0 for an order and for a user without VIEW_COST.
/// </summary>
public sealed record TransferLineDto(long Id, string MaterialCode, string MaterialName, string UomCode, decimal Quantity,
    decimal UnitPrice, decimal Amount, string? LotNumber, string? Position, string? Note, decimal DoneQuantity,
    long? SourceLineId = null, string? SourceCode = null);

/// <summary>A line: the material and unit are codes of the catalogs; the name is taken from the material when saved. The value of a line is never typed.</summary>
public sealed record SaveTransferLine(string MaterialCode, string UomCode, decimal Quantity, string? LotNumber = null,
    string? Position = null, string? Note = null, long? SourceLineId = null);

public sealed record TransferDto(long Id, string Code, DateOnly Date, DateOnly CreatedDate, DateOnly? RequiredDate,
    string UnitCode, string UnitName, string FromWarehouseCode, string FromWarehouseName, string ToWarehouseCode, string ToWarehouseName,
    string Reason, string? PersonName, string? SourceCode, string? Note, string Status, decimal TotalValue, string CreatedBy,
    string? ApprovedBy, IReadOnlyList<TransferLineDto> Items, uint Version);

public sealed record SaveTransferRequest(DateOnly Date, DateOnly? RequiredDate, string FromWarehouseCode, string ToWarehouseCode,
    string Reason, string? PersonName, string? Note, IReadOnlyList<SaveTransferLine> Items, uint? Version = null,
    /// <summary>Draft (default), Pending, Approved or Posted (an order has no Posted): the status to save at, as far as the user's rights reach.</summary>
    string? TargetStatus = null);

public sealed record TransferOption(string Code, string Name);
public sealed record TransferOptionsDto(IReadOnlyList<TransferOption> Warehouses);

/// <summary>A line a later voucher may still take (RemainingQuantity &gt; 0). Lot and position come from an issue line.</summary>
public sealed record OpenTransferLineDto(long LineId, string MaterialCode, string MaterialName, string UomCode, decimal Quantity,
    decimal DoneQuantity, decimal RemainingQuantity, decimal UnitPrice, string? LotNumber, string? Position, string? Note);

/// <summary>An approved order (to issue) or a posted issue (to receive) with something left: what the "Lấy từ ..." window lists.</summary>
public sealed record OpenTransferDto(long Id, string Code, DateOnly Date, DateOnly? RequiredDate, string FromWarehouseCode,
    string FromWarehouseName, string ToWarehouseCode, string ToWarehouseName, string Reason, string? PersonName, string? Note,
    IReadOnlyList<OpenTransferLineDto> Lines);

public interface ITransferVoucher
{
    /// <summary>One page of the vouchers of the unit the user may see (filters, search and sort of <see cref="VoucherListQuery"/>; the warehouse filter matches either warehouse).</summary>
    Task<PagedResult<TransferDto>> ListAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>The same list as an Excel file (all rows the filter leaves, not one page); needs the Export right.</summary>
    Task<ExportFile> ExportAsync(int userId, string unitCode, VoucherListQuery query, CancellationToken ct);
    /// <summary>Warehouses the company unit may use (shared ones included).</summary>
    Task<TransferOptionsDto> GetOptionsAsync(string unitCode, CancellationToken ct);
    Task<TransferDto> GetAsync(int userId, string unitCode, long id, CancellationToken ct);
    Task<TransferDto> CreateAsync(int userId, string unitCode, SaveTransferRequest request, CancellationToken ct);
    Task<TransferDto> UpdateAsync(int userId, string unitCode, long id, SaveTransferRequest request, CancellationToken ct);
    /// <summary>submit, withdraw, approve, cancel; post and unpost for an issue and a receipt.</summary>
    Task<TransferDto> ChangeStatusAsync(int userId, string unitCode, long id, string action, CancellationToken ct);
    Task<TransferDto> RejectAsync(int userId, string unitCode, long id, string reason, CancellationToken ct);
    Task DeleteAsync(int userId, string unitCode, long id, CancellationToken ct);
}

/// <summary>Lệnh điều chuyển kho (not posted).</summary>
public interface ITransferOrderService : ITransferVoucher
{
    /// <summary>
    /// Approved orders of the unit with something left to issue (for the issue screen: needs the transfer issue View right).
    /// <paramref name="exceptIssueId"/> is the issue being edited: what it already issues does not count, so the screen can show what it may still take.
    /// </summary>
    Task<IReadOnlyList<OpenTransferDto>> GetOpenAsync(int userId, string unitCode, long? exceptIssueId, CancellationToken ct);
}

/// <summary>Phiếu xuất điều chuyển kho (posts stock out of the source warehouse).</summary>
public interface ITransferIssueService : ITransferVoucher
{
    /// <summary>Posted issues of the unit with something left to receive (for the receipt screen); <paramref name="exceptReceiptId"/> is the receipt being edited.</summary>
    Task<IReadOnlyList<OpenTransferDto>> GetOpenAsync(int userId, string unitCode, long? exceptReceiptId, CancellationToken ct);
}

/// <summary>Phiếu nhập điều chuyển kho (posts stock into the destination warehouse at the value of the issue).</summary>
public interface ITransferReceiptService : ITransferVoucher;
