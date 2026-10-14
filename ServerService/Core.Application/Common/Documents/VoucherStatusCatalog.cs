using Core.Application.Common.Localization;
using Core.Application.Common.Permissions;

namespace Core.Application.Common.Documents;

/// <summary>
/// Which statuses a voucher has and what the code knows about them. A status is fixed by the code (it decides whether
/// the stock ledger moves); the company unit may only rename it and switch it off (sys_voucher_status, per unit), see
/// IVoucherStatusService. Rights to take a voucher into a status are the per-unit special rights ST_* of
/// SpecialRightCatalog.
/// </summary>
public static class VoucherStatusCatalog
{
    /// <summary>Vouchers that never post to the stock ledger: they have no "Đã ghi sổ" status (and no right for it).</summary>
    private static readonly HashSet<string> NonPosting = new(StringComparer.Ordinal) { "inv_issue_request", "pur_request", "pur_order", "inv_transfer_order" };

    private static readonly DocumentStatus[] All =
        [DocumentStatus.Draft, DocumentStatus.Pending, DocumentStatus.Approved, DocumentStatus.Posted, DocumentStatus.Cancelled];

    private static readonly DocumentStatus[] WithoutPosting =
        [DocumentStatus.Draft, DocumentStatus.Pending, DocumentStatus.Approved, DocumentStatus.Cancelled];

    public static bool Posts(string function) => !NonPosting.Contains(function);

    /// <summary>The statuses of the voucher function, in order.</summary>
    public static IReadOnlyList<DocumentStatus> StatusesOf(string function) => Posts(function) ? All : WithoutPosting;

    /// <summary>
    /// Only the approval step can be switched off (a voucher then skips approval). Draft is where every voucher starts, Cancelled
    /// is the way out of a wrong voucher, and Approved / Posted are what the rest of the system relies on (stock, ledgers).
    /// </summary>
    public static bool CanDisable(DocumentStatus status) => status == DocumentStatus.Pending;

    /// <summary>The name a unit has not changed (Messages "voucherStatus.{status}"), in the language of the request.</summary>
    public static string DefaultName(DocumentStatus status) => Messages.T($"voucherStatus.{status}");

    /// <summary>The per-unit right that lets a user take a voucher into <paramref name="status"/> (none for Draft).</summary>
    public static string? RightOf(DocumentStatus status) => status switch
    {
        DocumentStatus.Pending => SpecialRightCatalog.StatusPending,
        DocumentStatus.Approved => SpecialRightCatalog.StatusApproved,
        DocumentStatus.Posted => SpecialRightCatalog.StatusPosted,
        DocumentStatus.Cancelled => SpecialRightCatalog.StatusCancelled,
        _ => null
    };
}
