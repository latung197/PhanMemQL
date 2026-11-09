namespace Core.Application.Common.Lookups;

/// <summary>
/// Who may use one lookup (GET /api/lookups/{name}). A lookup answers a user when
/// <list type="bullet">
/// <item>the user is an administrator, or</item>
/// <item>the lookup is <see cref="Open"/> (base data every screen needs, such as currencies), or</item>
/// <item>the user has the <b>View</b> right of the catalog behind it (<see cref="Owner"/>), or</item>
/// <item>the user has the View right of one of the functions that pick from it (<see cref="Consumers"/>): the voucher that
/// has a material column, the report that filters by warehouse...</item>
/// </list>
/// The full catalog (list, export, edit) always needs the View right of its own function; the lookup is only the picker.
/// <see cref="SensitiveExtras"/> are extra columns (tax code, phone, creation time) that are only filled for the owner and
/// for <see cref="SensitiveFor"/>; everybody else gets them empty. <see cref="UnitScoped"/>: the codes are company units, and a
/// user who does not own the catalog sees only the units they may work in.
/// </summary>
public sealed record LookupAccessRule(string Name, string? Owner, IReadOnlyCollection<string> Consumers,
    IReadOnlyCollection<string> SensitiveExtras, IReadOnlyCollection<string> SensitiveFor, bool Open = false, bool UnitScoped = false);

/// <summary>
/// The rights of every lookup. One entry per lookup name; <c>LookupAccessTests</c> fails when a registered lookup has no entry,
/// when a function named here does not exist, or when an owner is not the function of its catalog. Add the entry together with
/// the lookup (docs/phat-trien/them-danh-muc.md Part 4.3).
/// </summary>
public static class LookupAccessCatalog
{
    private static readonly string[] None = [];

    // ---- Groups of functions that pick from the catalogs ----------------------------------------------------------------
    /// <summary>Stock vouchers: they have material, unit, location, lot and project columns.</summary>
    public static readonly string[] StockVouchers =
        ["inv_receipt", "inv_issue_request", "inv_issue", "inv_transfer_order", "inv_transfer_issue", "inv_transfer_receipt", "inv_audit_count"];
    public static readonly string[] PurchaseVouchers = ["pur_request", "pur_order", "pur_invoice"];
    public static readonly string[] SalesVouchers = ["sales_orders", "sales_delivery"];
    public static readonly string[] FinanceVouchers = ["fin_receipt_voucher", "fin_payment_voucher"];
    /// <summary>The stock reports and the two screens that read the ledger: they filter by warehouse and material group.</summary>
    public static readonly string[] StockReports =
        ["inv_report_stock", "inv_report_nxt", "inv_report_inward", "inv_report_outward", "inv_report_aging", "inv_calc_instant_stock", "inv_calc_monthly_cost"];

    private static string[] Join(params IEnumerable<string>[] parts) => parts.SelectMany(x => x).Distinct().ToArray();

    private static LookupAccessRule Rule(string name, string owner, IEnumerable<string>? consumers = null,
        string[]? sensitive = null, IEnumerable<string>? sensitiveFor = null) =>
        new(name, owner, (consumers ?? None).ToArray(), sensitive ?? None, (sensitiveFor ?? None).ToArray());

    private static LookupAccessRule OpenRule(string name, string? owner = null, bool unitScoped = false) =>
        new(name, owner, None, None, None, Open: true, UnitScoped: unitScoped);

    public static IReadOnlyList<LookupAccessRule> All { get; } =
    [
        // Units of measure: the unit column of every voucher line and of the price list, the material form, the conversions.
        Rule("uoms", "inv_uom_cat", Join(["inv_material_cat", "inv_uom_conversion_cat", "sales_price_list_cat"], StockVouchers, PurchaseVouchers, SalesVouchers)),
        Rule("materialUoms", "inv_uom_cat", Join(["inv_material_cat", "sales_price_list_cat"], StockVouchers, PurchaseVouchers, SalesVouchers)),
        // The full unit record: note, order and stamps are for the catalog's own screen only.
        Rule("uomsFull", "inv_uom_cat", ["inv_material_cat"], ["baseName", "note", "sortOrder", "createdAt", "updatedAt"]),
        Rule("uomConversions", "inv_uom_conversion_cat"),

        // Materials and their classification.
        Rule("materials", "inv_material_cat", Join(["inv_lot_cat", "inv_stock_norm_cat", "inv_uom_conversion_cat", "sales_price_list_cat"], StockVouchers, PurchaseVouchers, SalesVouchers)),
        Rule("materialGroups", "inv_material_group_cat", Join(["inv_material_cat"], StockReports)),
        Rule("materialTypes", "inv_material_type_cat", ["inv_material_cat"]),

        // Warehouses, locations, lots.
        Rule("warehouses", "inv_warehouse_cat", Join(["inv_location_cat", "inv_lot_cat", "inv_stock_norm_cat"], StockVouchers, PurchaseVouchers, SalesVouchers, StockReports)),
        Rule("warehouseTypes", "inv_warehouse_type_cat", ["inv_warehouse_cat"]),
        Rule("locations", "inv_location_cat", StockVouchers),
        Rule("lots", "inv_lot_cat", StockVouchers),

        // Partners: the tax code and phone are shown on the vouchers that print them, not to the other pickers (lot catalog, reports).
        Rule("suppliers", "inv_supplier_cat", Join(["inv_lot_cat", "pur_report_payable"], ["inv_receipt"], PurchaseVouchers), ["taxCode", "phone"],
            Join(["inv_receipt"], PurchaseVouchers)),
        Rule("supplierGroups", "pur_supplier_group_cat", ["inv_supplier_cat"]),
        Rule("customers", "sales_customers", Join(["inv_issue", "sales_report"], SalesVouchers), ["taxCode"], Join(["inv_issue"], SalesVouchers)),
        Rule("customerGroups", "sales_customer_group_cat", ["sales_customers", "sales_price_list_cat"]),
        Rule("priceLists", "sales_price_list_cat", ["sales_orders"]),

        // Purchasing and project data.
        Rule("projects", "pur_project_cat", Join(["pur_report_project"], StockVouchers, PurchaseVouchers, ["sales_orders"])),
        Rule("paymentTerms", "pur_payment_term_cat", ["sales_customers", "sales_orders", "pur_order", "pur_invoice"]),

        // Finance and tax.
        Rule("accounts", "fin_account_cat", Join(["sys_tax_rates"], FinanceVouchers)),
        Rule("taxRates", "sys_tax_rates", Join(["inv_material_cat"], PurchaseVouchers, SalesVouchers)),

        // Base data that every screen and the shell read: left open to signed-in users. Company units are cut to the units the user
        // may work in (the owner of the catalog sees all of them).
        OpenRule("currencies", "sys_currencies"),
        OpenRule("departments", "sys_departments"),
        OpenRule("companyUnits", "inv_company_unit_cat", unitScoped: true)
    ];

    private static readonly Dictionary<string, LookupAccessRule> ByName = All.ToDictionary(x => x.Name, StringComparer.OrdinalIgnoreCase);

    public static LookupAccessRule? Find(string name) => ByName.GetValueOrDefault(name);
}
