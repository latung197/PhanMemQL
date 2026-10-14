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
public sealed record SpecialRightDefinition(string Function, string Code, string TextKey, string Group, bool PerUnit = false)
{
    public string Name => Messages.T($"right.{TextKey}.name");
    public string Description => Messages.T($"right.{TextKey}.description");
}

/// <summary>
/// Special rights on top of the five standard actions, declared per function. The frontend loads this
/// list from GET /api/settings/permission-catalog, so a new right only has to be added here.
/// Stored as "{function}:{code}" in sys_role_right / sys_user_right. A right that is <c>PerUnit</c> (the voucher status
/// rights ST_*) is granted for one company unit: its stored code carries the unit, "{function}:{code}@{unit}"
/// (e.g. "inv_receipt:ST_POSTED@DVCS01"), so everything that stores, grants, audits and lists rights works unchanged.
/// </summary>
public static class SpecialRightCatalog
{
    // Codes shared by the voucher functions.
    public const string ViewPrice = "VIEW_PRICE";
    public const string ViewCost = "VIEW_COST";
    public const string ViewAll = "VIEW_ALL";
    /// <summary>Rename or merge the codes of a catalog (đổi mã, gộp mã); only on the catalogs of <see cref="CodeChangeCatalogs"/>.</summary>
    public const string ChangeCode = "CHANGE_CODE";
    // Status rights (per company unit): the right to take a voucher into that status and to change a voucher while it is in it.
    public const string StatusPending = "ST_PENDING";
    public const string StatusApproved = "ST_APPROVED";
    public const string StatusPosted = "ST_POSTED";
    public const string StatusCancelled = "ST_CANCELLED";
    /// <summary>Backward step: take a posted voucher back to Approved.</summary>
    public const string StatusUnpost = "ST_UNPOST";
    /// <summary>Change or delete a voucher that is already posted: the posting is reversed, the change made and the voucher posted again in one transaction (refused when the stock would go negative).</summary>
    public const string StatusEditPosted = "ST_EDIT_POSTED";

    /// <summary>Separates the code from the company unit in the stored code of a per-unit right.</summary>
    public const char UnitSeparator = '@';

    // Sending notifications from the header bell; declared on the dashboard every user opens.
    public const string NotificationFunction = "overview_main";
    public const string SendNotification = "SEND_NOTIFICATION";
    public const string SendNotificationAll = "SEND_NOTIFICATION_ALL";

    private static readonly string[] Vouchers = VoucherCatalog.All.Select(x => x.Function).ToArray();

    private static readonly string[] PricedCatalogsAndReports =
    [
        "inv_material_cat", "inv_report_stock", "inv_report_nxt", "inv_report_inward", "inv_report_outward",
        "inv_report_aging", "sales_report", "pur_report_project"
    ];

    /// <summary>
    /// Catalog functions that allow renaming and merging codes (their services say CodeChange: true in their CatalogSpec; a test keeps
    /// both lists equal). Catalogs whose codes are built into other codes (lots, units of measure, exchange rates...) are not here.
    /// </summary>
    public static readonly string[] CodeChangeCatalogs =
    [
        "inv_supplier_cat", "pur_supplier_group_cat", "pur_project_cat", "pur_payment_term_cat",
        "inv_warehouse_type_cat", "inv_material_group_cat", "inv_material_type_cat"
    ];

    public static IReadOnlyList<SpecialRightDefinition> All { get; } = Build();

    private static List<SpecialRightDefinition> Build()
    {
        var list = new List<SpecialRightDefinition>();
        foreach (var fn in Vouchers)
        {
            list.Add(new(fn, ViewPrice, "voucherViewPrice", SpecialRightGroups.Data));
            if (fn is "inv_issue" or "inv_transfer_issue" or "inv_transfer_receipt" or "sales_orders" or "sales_delivery")
                list.Add(new(fn, ViewCost, "voucherViewCost", SpecialRightGroups.Data));
            list.Add(new(fn, ViewAll, "viewAll", SpecialRightGroups.Scope));
            list.Add(new(fn, StatusPending, "statusPending", SpecialRightGroups.Status, PerUnit: true));
            list.Add(new(fn, StatusApproved, "statusApproved", SpecialRightGroups.Status, PerUnit: true));
            if (VoucherStatusCatalog.Posts(fn))
            {
                list.Add(new(fn, StatusPosted, "statusPosted", SpecialRightGroups.Status, PerUnit: true));
                list.Add(new(fn, StatusUnpost, "statusUnpost", SpecialRightGroups.Status, PerUnit: true));
                list.Add(new(fn, StatusEditPosted, "statusEditPosted", SpecialRightGroups.Status, PerUnit: true));
            }
            list.Add(new(fn, StatusCancelled, "statusCancelled", SpecialRightGroups.Status, PerUnit: true));
        }
        foreach (var fn in PricedCatalogsAndReports)
        {
            list.Add(new(fn, ViewPrice, "catalogViewPrice", SpecialRightGroups.Data));
            list.Add(new(fn, ViewCost, "catalogViewCost", SpecialRightGroups.Data));
        }
        foreach (var fn in CodeChangeCatalogs) list.Add(new(fn, ChangeCode, "changeCode", SpecialRightGroups.Feature));
        list.Add(new(NotificationFunction, SendNotification, "sendNotification", SpecialRightGroups.Feature));
        list.Add(new(NotificationFunction, SendNotificationAll, "sendNotificationAll", SpecialRightGroups.Feature));
        return list;
    }

    public static string Key(string function, string code) => $"{function}:{code}";

    /// <summary>Key of a per-unit right for one company unit: "{function}:{code}@{unit}".</summary>
    public static string UnitKey(string function, string code, string unitCode) => $"{function}:{code}{UnitSeparator}{unitCode}";

    /// <summary>Splits a stored code into the right code and the company unit ("ST_POSTED@DVCS01"); the unit is null for rights of every unit.</summary>
    public static (string Code, string? Unit) SplitUnit(string code)
    {
        var at = code.IndexOf(UnitSeparator);
        return at < 0 ? (code, null) : (code[..at], code[(at + 1)..]);
    }

    /// <summary>The per-unit definitions (voucher status rights).</summary>
    public static IEnumerable<SpecialRightDefinition> PerUnitRights => All.Where(x => x.PerUnit);

    /// <summary>
    /// Rights granted when special rights are introduced into an existing database, so nobody loses
    /// what they could see before: data and scope rights where the matrix allows "Xem". Feature rights were
    /// administrator-only before, so nobody gets them. Administrators then narrow them down. The status rights
    /// depend on the unit: see <see cref="InitialStatusKeysFor"/>.
    /// </summary>
    public static IEnumerable<SpecialRightDefinition> InitialFor(IReadOnlyDictionary<string, Core.Domain.Modules.Users.ActionPermissions> matrix) =>
        All.Where(r => r.Group != SpecialRightGroups.Feature && !r.PerUnit && matrix.TryGetValue(r.Function, out var actions) && actions.View);

    /// <summary>
    /// The status rights, written for every unit, that a matrix calls for: sending for approval where the user may add or change the
    /// voucher; approving, posting, unposting and cancelling where they may "Duyệt".
    /// </summary>
    public static IEnumerable<string> InitialStatusKeysFor(IReadOnlyDictionary<string, Core.Domain.Modules.Users.ActionPermissions> matrix,
        IEnumerable<string> unitCodes)
    {
        var units = unitCodes.ToList();
        foreach (var right in PerUnitRights)
        {
            if (!matrix.TryGetValue(right.Function, out var actions)) continue;
            var granted = right.Code == StatusPending ? actions.Create || actions.Edit : actions.Approve;
            if (!granted) continue;
            foreach (var unit in units) yield return UnitKey(right.Function, right.Code, unit);
        }
    }

    /// <summary>Every key of the rights that do not depend on a unit. Per-unit rights only exist with a unit: see <see cref="KeysFor"/>.</summary>
    public static IReadOnlySet<string> Keys { get; } = All.Where(x => !x.PerUnit).Select(x => Key(x.Function, x.Code))
        .ToHashSet(StringComparer.Ordinal);

    private static readonly HashSet<string> PerUnitKeys = All.Where(x => x.PerUnit).Select(x => Key(x.Function, x.Code))
        .ToHashSet(StringComparer.Ordinal);

    /// <summary>Every right of an administrator: the rights without a unit plus the per-unit rights of each given unit.</summary>
    public static IReadOnlySet<string> KeysFor(IEnumerable<string> unitCodes)
    {
        var keys = new HashSet<string>(Keys, StringComparer.Ordinal);
        foreach (var unit in unitCodes)
            foreach (var right in PerUnitRights)
                keys.Add(UnitKey(right.Function, right.Code, unit));
        return keys;
    }

    /// <summary>A known right: one without a unit, or a per-unit right written with a unit ("fn:ST_POSTED@DVCS01").</summary>
    public static bool IsKnown(string key)
    {
        if (Keys.Contains(key)) return true;
        var at = key.IndexOf(UnitSeparator);
        return at > 0 && at < key.Length - 1 && PerUnitKeys.Contains(key[..at]);
    }

    /// <summary>Splits "{function}:{code}".</summary>
    public static (string Function, string Code) Split(string key)
    {
        var index = key.IndexOf(':');
        return index < 0 ? (key, string.Empty) : (key[..index], key[(index + 1)..]);
    }
}
