using Core.Application.Common.Localization;

namespace Core.Infrastructure.Common.Lookups;

/// <summary>
/// Every catalog offered by GET /api/lookups/{name} (ô chọn mã + F2): one entry per catalog, see docs/phat-trien/them-danh-muc.md.
/// The list is also read by tests, which check that each entry names every table its projection reads
/// (<see cref="LookupDefinition.Tables"/>), because the cached copy of a lookup is dropped when one of them is written.
/// </summary>
public static class LookupCatalogs
{
    public static IReadOnlyList<LookupDefinition> All { get; } =
    [
        new LookupDefinition("uoms", db =>
        {
            var language = Messages.CurrentLanguage;
            var baseLanguage = language.Split('-')[0];
            return db.Uoms.Select(x => new LookupRow { Code = x.Code,
                Name = db.UomTranslations.Where(t => t.UomCode == x.Code &&
                    (t.LanguageCode == language || t.LanguageCode == baseLanguage))
                    .OrderByDescending(t => t.LanguageCode == language)
                    .Select(t => t.Name).FirstOrDefault() ?? x.Name,
                IsActive = x.IsActive, Extra1 = x.Symbol });
        }, ["erp_uom", "erp_uom_translation"], "symbol"),

        new LookupDefinition("suppliers", db => db.Suppliers.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive, Extra1 = x.TaxCode, Extra2 = x.Phone, Extra3 = x.SupplierGroupCode }),
        ["erp_supplier"], "taxCode", "phone", "supplierGroupCode"),

        // Extras: status of the project (only PLANNING / ACTIVE projects take new vouchers), department code.
        new LookupDefinition("projects", db => db.Projects.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive, Extra1 = x.Status, Extra2 = x.DepartmentCode }),
        ["erp_project"], "status", "departmentCode"),

        // Extra: days to pay.
        new LookupDefinition("paymentTerms", db => db.PaymentTerms.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive, Extra1 = x.Days.ToString() }),
        ["erp_payment_term"], "days"),

        new LookupDefinition("supplierGroups", db => db.SupplierGroups.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive }), ["erp_supplier_group"]),

        new LookupDefinition("customerGroups", db => db.CustomerGroups.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive }), ["erp_customer_group"]),

        // Extras: tax code, customer group, default payment term.
        new LookupDefinition("customers", db => db.Customers.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive, Extra1 = x.TaxCode, Extra2 = x.CustomerGroupCode, Extra3 = x.PaymentTermCode }),
        ["erp_customer"], "taxCode", "customerGroupCode", "paymentTermCode"),

        // Extras: currency, customer group (empty = every customer).
        new LookupDefinition("priceLists", db => db.PriceLists.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive, Extra1 = x.CurrencyCode, Extra2 = x.CustomerGroupCode }),
        ["erp_price_list"], "currencyCode", "customerGroupCode"),
        new LookupDefinition("productionTeams", db => db.ProductionTeams.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive }), ["erp_production_team"]),

        new LookupDefinition("productionOperations", db => db.ProductionOperations.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive, Extra1 = x.ProductionTeamCode }),
        ["erp_production_operation"], "teamCode"),

        new LookupDefinition("productionProcesses", db => db.ProductionProcesses.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive }), ["erp_production_process"]),

        new LookupDefinition("uomConversions", db => db.UomConversions.Select(x =>
            new LookupRow { Code = x.Code, Name = x.FromUomCode + " → " + x.ToUomCode, IsActive = x.IsActive,
                Extra1 = x.MaterialCode, Extra2 = x.Factor.ToString() }), ["erp_uom_conversion"], "materialCode", "factor"),

        new LookupDefinition("materialGroups", db => db.MaterialGroups.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive }), ["erp_material_group"]),

        new LookupDefinition("materialTypes", db => db.MaterialTypes.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive, Extra1 = x.GroupName }), ["erp_material_type"], "groupName"),

        new LookupDefinition("departments", db => db.Departments.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive }), ["sys_department"]),

        // Extras: type (VAT / IMPORT / OTHER), rate in percent, 1 when exempt.
        new LookupDefinition("taxRates", db => db.TaxRates.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive, Extra1 = x.TaxType,
                Extra2 = x.Rate.ToString(), Extra3 = x.IsExempt ? "1" : "0" }), ["sys_tax_rate"], "taxType", "rate", "isExempt"),

        new LookupDefinition("currencies", db => db.Currencies.Select(x =>
            new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive, Extra1 = x.Symbol, Extra2 = x.DecimalPlaces.ToString(),
                Extra3 = x.IsBase ? "1" : "0" }), ["sys_currency"], "symbol", "decimalPlaces", "isBase"),

        new LookupDefinition("companyUnits", db =>
        {
            var language = Messages.CurrentLanguage;
            var baseLanguage = language.Split('-')[0];
            return db.CompanyUnits.Select(x => new LookupRow { Code = x.Code,
                Name = db.CompanyUnitTranslations.Where(t => t.UnitCode == x.Code && t.LanguageCode == language).Select(t => t.Name).FirstOrDefault()
                    ?? db.CompanyUnitTranslations.Where(t => t.UnitCode == x.Code && t.LanguageCode == baseLanguage).Select(t => t.Name).FirstOrDefault()
                    ?? x.Name,
                IsActive = x.IsActive, Extra1 = x.ShortName, Extra2 = x.IsDefault ? "1" : "0" });
        }, ["sys_company_unit", "sys_company_unit_translation"], "shortName", "isDefault"),

        // "warehouses" is a LookupProvider (WarehouseLookup): it lists only the warehouses of the working unit.

        // [tao-danh-muc] Tra cứu của danh mục mới: thêm new LookupDefinition(...), ngay trên dòng này.
        new LookupDefinition("warehouseTypes", db =>
        {
            var language = Messages.CurrentLanguage;
            var baseLanguage = language.Split('-')[0];
            return db.WarehouseTypes.Select(x => new LookupRow { Code = x.Code,
                Name = db.WarehouseTypeTranslations.Where(t => t.WarehouseTypeCode == x.Code &&
                    (t.LanguageCode == language || t.LanguageCode == baseLanguage))
                    .OrderByDescending(t => t.LanguageCode == language)
                    .Select(t => t.Name).FirstOrDefault() ?? x.Name,
                IsActive = x.IsActive });
        }, ["erp_warehouse_type", "erp_warehouse_type_translation"])
    ];
}
