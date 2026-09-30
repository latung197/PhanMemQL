namespace Core.Application.Common.Permissions;

/// <summary>Kind of special right, used to group them on the permission screen.</summary>
public static class SpecialRightGroups
{
    /// <summary>Which values of the document the user may see (prices, cost).</summary>
    public const string Data = "data";
    /// <summary>What the user may do depending on the document status.</summary>
    public const string Status = "status";
    /// <summary>Which documents the user may see (own only or everybody's).</summary>
    public const string Scope = "scope";
    /// <summary>Extra features that are not part of a document (e.g. sending notifications).</summary>
    public const string Feature = "feature";
}

public sealed record SpecialRightDefinition(string Function, string Code, string Name, string Group, string Description);

/// <summary>
/// Special rights on top of the five standard actions, declared per function. The frontend loads this
/// list from GET /api/settings/permission-catalog, so a new right only has to be added here.
/// Stored as "{function}:{code}" in sys_role_right / sys_user_right.
/// </summary>
public static class SpecialRightCatalog
{
    // Codes shared by the voucher functions.
    public const string ViewPrice = "VIEW_PRICE";
    public const string ViewCost = "VIEW_COST";
    public const string ViewAll = "VIEW_ALL";
    public const string EditPending = "EDIT_PENDING";
    public const string EditApproved = "EDIT_APPROVED";
    public const string Post = "POST";
    public const string Unpost = "UNPOST";
    public const string Cancel = "CANCEL";

    // Sending notifications from the header bell; declared on the dashboard every user opens.
    public const string NotificationFunction = "overview_main";
    public const string SendNotification = "SEND_NOTIFICATION";
    public const string SendNotificationAll = "SEND_NOTIFICATION_ALL";

    private static readonly string[] Vouchers =
    [
        "inv_receipt", "inv_issue", "inv_transfer_order", "inv_transfer_issue", "inv_transfer_receipt",
        "inv_audit_count", "sales_orders", "sales_delivery", "fin_receipt_voucher", "fin_payment_voucher"
    ];

    private static readonly string[] PricedCatalogsAndReports =
    [
        "inv_material_cat", "inv_report_stock", "inv_report_nxt", "inv_report_inward", "inv_report_outward",
        "inv_report_aging", "sales_report"
    ];

    public static IReadOnlyList<SpecialRightDefinition> All { get; } = Build();

    private static List<SpecialRightDefinition> Build()
    {
        var list = new List<SpecialRightDefinition>();
        foreach (var fn in Vouchers)
        {
            list.Add(new(fn, ViewPrice, "Xem đơn giá & thành tiền", SpecialRightGroups.Data,
                "Không có quyền này thì đơn giá, thành tiền và tổng tiền trên phiếu bị ẩn."));
            if (fn is "inv_issue" or "inv_transfer_issue" or "sales_orders" or "sales_delivery")
                list.Add(new(fn, ViewCost, "Xem giá vốn", SpecialRightGroups.Data, "Xem giá vốn xuất kho và lãi gộp."));
            list.Add(new(fn, ViewAll, "Xem phiếu của người khác", SpecialRightGroups.Scope,
                "Không có quyền này thì chỉ thấy phiếu do chính mình lập."));
            list.Add(new(fn, EditPending, "Sửa phiếu đang chờ duyệt", SpecialRightGroups.Status,
                "Sửa phiếu đã trình duyệt mà chưa được duyệt."));
            list.Add(new(fn, EditApproved, "Sửa phiếu đã duyệt", SpecialRightGroups.Status,
                "Sửa phiếu đã được phê duyệt nhưng chưa ghi sổ."));
            list.Add(new(fn, Post, "Ghi sổ", SpecialRightGroups.Status, "Ghi phiếu đã duyệt vào sổ kho / sổ cái."));
            list.Add(new(fn, Unpost, "Bỏ ghi sổ", SpecialRightGroups.Status, "Hủy ghi sổ để sửa lại phiếu."));
            list.Add(new(fn, Cancel, "Hủy phiếu", SpecialRightGroups.Status, "Hủy phiếu chưa ghi sổ (kể cả phiếu người khác lập)."));
        }
        foreach (var fn in PricedCatalogsAndReports)
        {
            list.Add(new(fn, ViewPrice, "Xem giá bán & giá trị", SpecialRightGroups.Data, "Xem giá bán, doanh thu và giá trị hàng."));
            list.Add(new(fn, ViewCost, "Xem giá vốn", SpecialRightGroups.Data, "Xem giá mua, giá vốn và giá trị tồn."));
        }
        list.Add(new(NotificationFunction, SendNotification, "Gửi thông báo trong đơn vị", SpecialRightGroups.Feature,
            "Gửi thông báo cho mọi người hoặc một người thuộc đơn vị cơ sở đang làm việc."));
        list.Add(new(NotificationFunction, SendNotificationAll, "Gửi thông báo toàn hệ thống", SpecialRightGroups.Feature,
            "Gửi thông báo tới mọi đơn vị cơ sở hoặc một đơn vị bất kỳ."));
        return list;
    }

    public static string Key(string function, string code) => $"{function}:{code}";

    /// <summary>
    /// Rights granted when special rights are introduced into an existing database, so nobody loses
    /// what they could see before: data and scope rights where the matrix allows "Xem", status rights
    /// where it allows "Duyệt". Feature rights were administrator-only before, so nobody gets them.
    /// Administrators then narrow them down.
    /// </summary>
    public static IEnumerable<SpecialRightDefinition> InitialFor(IReadOnlyDictionary<string, Core.Domain.Modules.Users.ActionPermissions> matrix) =>
        All.Where(r => r.Group != SpecialRightGroups.Feature && matrix.TryGetValue(r.Function, out var actions)
            && (r.Group == SpecialRightGroups.Status ? actions.Approve : actions.View));

    public static IReadOnlySet<string> Keys { get; } = All.Select(x => Key(x.Function, x.Code)).ToHashSet(StringComparer.Ordinal);

    public static bool IsKnown(string key) => Keys.Contains(key);

    /// <summary>Splits "{function}:{code}".</summary>
    public static (string Function, string Code) Split(string key)
    {
        var index = key.IndexOf(':');
        return index < 0 ? (key, string.Empty) : (key[..index], key[(index + 1)..]);
    }
}
