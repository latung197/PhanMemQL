using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;

namespace Core.Application.Common.Paging;

/// <summary>
/// Query of the list of a voucher screen (phiếu nhập kho, phiếu xuất kho, phiếu yêu cầu xuất kho) and of its Excel export:
/// GET api/inventory/goods-receipts?page=1&amp;pageSize=20&amp;sort=date&amp;dir=desc&amp;status=Approved&amp;from=2026-10-01.
/// Vouchers are listed per company unit of the session, and a user without VIEW_ALL only sees the vouchers they created.
/// </summary>
/// <param name="Search">Accent-insensitive text matched against the code, note, partner, warehouse and the items of the voucher.</param>
/// <param name="Status">Draft, Pending, Approved, Posted or Cancelled.</param>
/// <param name="Warehouse">Warehouse code.</param>
/// <param name="VoucherType">Exact purpose / kind of the voucher (e.g. "Nhập mua mới").</param>
/// <param name="Code">One code part (contains), or several full codes separated by commas.</param>
/// <param name="From">Vouchers dated on or after this day.</param>
/// <param name="To">Vouchers dated on or before this day.</param>
/// <param name="Department">Department code (issue and purchase requests have one).</param>
/// <param name="Supplier">Supplier code (purchase requests and orders).</param>
public sealed record VoucherListQuery(int Page = 1, int PageSize = PagingLimits.DefaultPageSize, string? Sort = null,
    string? Dir = null, string? Search = null, string? Status = null, string? Warehouse = null, string? VoucherType = null,
    string? Code = null, DateOnly? From = null, DateOnly? To = null, string? Department = null, string? Supplier = null) : IPagedQuery
{
    /// <summary>The status filter as a status; null = every status. Anything else is refused.</summary>
    public DocumentStatus? StatusFilter => string.IsNullOrWhiteSpace(Status) ? null
        : Enum.TryParse<DocumentStatus>(Status.Trim(), out var status) && Enum.IsDefined(status) ? status
        : throw new BusinessRuleException("paging.statusInvalid");

    /// <summary>The code filter split into its parts (empty when there is none).</summary>
    public IReadOnlyList<string> CodeParts => string.IsNullOrWhiteSpace(Code) ? []
        : Code.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(x => x.ToUpperInvariant()).ToList();
}
