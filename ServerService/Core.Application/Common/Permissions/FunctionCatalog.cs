using Core.Application.Common.Localization;

namespace Core.Application.Common.Permissions;

/// <summary>
/// Function codes = SubMenuKey in Frontend/src/types/index.ts (declared in Frontend/src/config/functions.ts);
/// module keys = ModuleCategoryKey. Keep both lists in sync with the frontend. Missing codes are inserted
/// into sys_command at startup. Vouchers are also listed in Common/Documents/VoucherCatalog.
/// </summary>
public static class FunctionCatalog
{
    public static IReadOnlyDictionary<string, string> Functions { get; } =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["overview_main"] = "Bàn tổng quan",
            ["inv_receipt"] = "Phiếu nhập kho",
            ["inv_issue"] = "Phiếu xuất kho",
            ["inv_transfer_order"] = "Lệnh điều chuyển kho",
            ["inv_transfer_issue"] = "Phiếu xuất điều chuyển kho",
            ["inv_transfer_receipt"] = "Phiếu nhập điều chuyển kho",
            ["inv_audit_count"] = "Phiếu kiểm kê hàng hóa",
            ["inv_calc_monthly_cost"] = "Tính giá trung bình tháng",
            ["inv_calc_instant_stock"] = "Tính tồn kho tức thời",
            ["inv_approve_receipt"] = "Phê duyệt nhập kho",
            ["inv_approve_issue"] = "Phê duyệt xuất kho",
            ["inv_approve_transfer"] = "Phê duyệt điều chuyển",
            ["inv_material_cat"] = "Danh mục vật tư và sản phẩm",
            ["inv_material_type_cat"] = "Danh mục loại vật tư",
            ["inv_warehouse_cat"] = "Danh mục kho",
            ["inv_location_cat"] = "Danh mục vị trí lưu kho",
            ["inv_uom_cat"] = "Danh mục đơn vị tính",
            ["inv_uom_conversion_cat"] = "Quy đổi đơn vị tính",
            ["inv_stock_norm_cat"] = "Định mức tồn kho",
            ["inv_lot_cat"] = "Lô và hạn sử dụng",
            ["inv_report_inward"] = "Báo cáo hàng nhập",
            ["inv_report_outward"] = "Báo cáo hàng xuất",
            ["inv_report_stock"] = "Báo cáo tồn kho",
            ["inv_report_nxt"] = "Báo cáo nhập xuất tồn",
            ["inv_report_aging"] = "Báo cáo tuổi hàng tồn",
            ["sys_users"] = "Người dùng và phân quyền",
            ["inv_company_unit_cat"] = "Đơn vị cơ sở",
            ["sys_departments"] = "Phòng ban",
            ["sys_default_config"] = "Cài đặt mặc định",
            ["sys_fiscal_year"] = "Năm làm việc và khóa sổ",
            ["sys_currencies"] = "Ngoại tệ",
            ["sys_exchange_rates"] = "Tỷ giá",
            ["sys_languages"] = "Ngôn ngữ",
            ["sys_audit_log"] = "Nhật ký thay đổi",
            ["sales_customers"] = "Khách hàng",
            ["sales_orders"] = "Đơn hàng",
            ["sales_delivery"] = "Giao hàng",
            ["sales_report"] = "Báo cáo doanh số",
            ["fin_categories"] = "Khoản mục thu chi",
            ["fin_receipt_voucher"] = "Phiếu thu",
            ["fin_payment_voucher"] = "Phiếu chi",
            ["fin_report"] = "Báo cáo tài chính",
            ["hr_list"] = "Nhân sự",
            ["hr_payroll"] = "Chấm công và lương",
            ["hr_report"] = "Báo cáo nhân sự",
            ["hr_resource_booking"] = "Đăng ký tài nguyên",
            ["reports_main"] = "Báo cáo tổng hợp",
            ["ai_main"] = "Trợ lý AI",
            ["settings_main"] = "Cài đặt hệ thống"
        };

    public static IReadOnlySet<string> ModuleKeys { get; } = new HashSet<string>(StringComparer.Ordinal)
    {
        "overview", "inventory", "sales", "finance", "hr", "reports", "ai", "settings"
    };

    public static bool IsFunction(string code) => Functions.ContainsKey(code);

    /// <summary>
    /// Name in the language of the request (Messages "function.{code}"); the Vietnamese name above when the language
    /// has none. The Vietnamese names stay here because sys_command is filled from them.
    /// </summary>
    public static string Name(string code, string? language = null) =>
        Messages.Find(language ?? Messages.CurrentLanguage, $"function.{code}") ?? Functions.GetValueOrDefault(code, code);
}
