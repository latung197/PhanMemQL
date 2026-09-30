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

    public static VoucherDefinition? FindByType(string voucherType) =>
        All.FirstOrDefault(x => string.Equals(x.VoucherType, voucherType, StringComparison.OrdinalIgnoreCase));

    public static VoucherDefinition? FindByFunction(string function) => All.FirstOrDefault(x => x.Function == function);
}
