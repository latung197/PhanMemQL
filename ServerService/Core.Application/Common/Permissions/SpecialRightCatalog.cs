using Core.Application.Common.Documents;
using Core.Application.Common.Localization;

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

/// <summary>
/// One special right. Its name and description are texts "right.{TextKey}.name" / ".description" of
/// Common/Localization/Messages.*.json, in the language of the request.
/// </summary>
public sealed record SpecialRightDefinition(string Function, string Code, string TextKey, string Group)
{
    public string Name => Messages.T($"right.{TextKey}.name");
    public string Description => Messages.T($"right.{TextKey}.description");
}

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

    private static readonly string[] Vouchers = VoucherCatalog.All.Select(x => x.Function).ToArray();

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
            list.Add(new(fn, ViewPrice, "voucherViewPrice", SpecialRightGroups.Data));
            if (fn is "inv_issue" or "inv_transfer_issue" or "sales_orders" or "sales_delivery")
                list.Add(new(fn, ViewCost, "voucherViewCost", SpecialRightGroups.Data));
            list.Add(new(fn, ViewAll, "viewAll", SpecialRightGroups.Scope));
            list.Add(new(fn, EditPending, "editPending", SpecialRightGroups.Status));
            list.Add(new(fn, EditApproved, "editApproved", SpecialRightGroups.Status));
            list.Add(new(fn, Post, "post", SpecialRightGroups.Status));
            list.Add(new(fn, Unpost, "unpost", SpecialRightGroups.Status));
            list.Add(new(fn, Cancel, "cancel", SpecialRightGroups.Status));
        }
        foreach (var fn in PricedCatalogsAndReports)
        {
            list.Add(new(fn, ViewPrice, "catalogViewPrice", SpecialRightGroups.Data));
            list.Add(new(fn, ViewCost, "catalogViewCost", SpecialRightGroups.Data));
        }
        list.Add(new(NotificationFunction, SendNotification, "sendNotification", SpecialRightGroups.Feature));
        list.Add(new(NotificationFunction, SendNotificationAll, "sendNotificationAll", SpecialRightGroups.Feature));
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
