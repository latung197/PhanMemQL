using Core.Application.Common.Localization;

namespace Core.Application.Common.Documents;

/// <summary>A voucher function and the code of its number series (e.g. inv_receipt → PNK).</summary>
public sealed record VoucherDefinition(string Function, string VoucherType, string Name);

/// <summary>
/// Every voucher (chứng từ) of the system. Declaring a voucher here gives it, with no other change:
/// a number series in sys_voucher_numbering (created at startup, editable in Settings), the voucher
/// special rights (xem giá, sửa phiếu đã duyệt, ghi sổ...) and a place in the approval rule screen.
/// The function code must also be in FunctionCatalog.
/// </summary>
public static class VoucherCatalog
{
    public const string DefaultPattern = "{PREFIX}-{YYYY}{MM}-{SEQ}";
    public const short DefaultDigits = 4;

    public static IReadOnlyList<VoucherDefinition> All { get; } =
    [
        new("inv_receipt", "PNK", "Phiếu nhập kho"),
        new("inv_issue", "PXK", "Phiếu xuất kho"),
        new("inv_transfer_order", "LDC", "Lệnh điều chuyển kho"),
        new("inv_transfer_issue", "PXDC", "Phiếu xuất điều chuyển"),
        new("inv_transfer_receipt", "PNDC", "Phiếu nhập điều chuyển"),
        new("inv_audit_count", "PKK", "Phiếu kiểm kê"),
        new("sales_orders", "SO", "Đơn bán hàng"),
        new("sales_delivery", "PGH", "Phiếu giao hàng"),
        new("fin_receipt_voucher", "PT", "Phiếu thu"),
        new("fin_payment_voucher", "PC", "Phiếu chi")
    ];

    /// <summary>
    /// Approval screens of the "Phê duyệt" menu and the vouchers they approve. The "Duyệt" right on such a screen
    /// approves those vouchers just like the "Duyệt" right on the voucher itself (Frontend utils/permissions.ts
    /// APPROVAL_SCREENS mirrors this list).
    /// </summary>
    public static IReadOnlyDictionary<string, string[]> ApprovalScreens { get; } = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["inv_approve_receipt"] = ["inv_receipt"],
        ["inv_approve_issue"] = ["inv_issue"],
        ["inv_approve_transfer"] = ["inv_transfer_order", "inv_transfer_issue", "inv_transfer_receipt"]
    };

    public static IEnumerable<string> ApprovalScreensOf(string voucherFunction) =>
        ApprovalScreens.Where(x => x.Value.Contains(voucherFunction)).Select(x => x.Key);

    public static VoucherDefinition? FindByType(string voucherType) =>
        All.FirstOrDefault(x => string.Equals(x.VoucherType, voucherType, StringComparison.OrdinalIgnoreCase));

    public static VoucherDefinition? FindByFunction(string function) => All.FirstOrDefault(x => x.Function == function);

    /// <summary>Voucher name in the language of the request (Messages "voucher.{type}"), else <paramref name="fallback"/>.</summary>
    public static string DisplayName(string voucherType, string fallback) =>
        Messages.Find(Messages.CurrentLanguage, $"voucher.{voucherType.ToUpperInvariant()}") ?? fallback;
}
