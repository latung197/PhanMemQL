using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.Currencies;
using Core.Domain.Modules.Inventory;
using Core.Domain.Modules.Sales.Categories.CustomerGroups;

namespace Core.Domain.Modules.Sales.Categories.PriceLists;

/// <summary>
/// Bảng giá bán: selling prices in one currency, valid from a day to a day (empty = no end) and for one customer group (empty = every
/// customer). Its lines give the price per material and unit, with price steps by quantity. A sales order takes its price from the
/// price list that fits the customer, the day and the currency (the one of the customer's group first, then the general ones).
/// </summary>
[Audited("sales_price_list_cat", "priceList", Label = "{Code} - {Name}")]
[Table("erp_price_list")]
public class PriceList : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(200)] public string Name { get; set; } = string.Empty;
    [References<Currency>]
    [Required, Column("currency_code"), MaxLength(10)] public string CurrencyCode { get; set; } = "VND";
    /// <summary>The customer group the prices are for; empty = every customer.</summary>
    [References<CustomerGroup>(Optional = true)]
    [Column("customer_group_code"), MaxLength(20)] public string? CustomerGroupCode { get; set; }
    [Column("valid_from")] public DateOnly ValidFrom { get; set; }
    /// <summary>Last day the prices hold; empty = no end.</summary>
    [Column("valid_to")] public DateOnly? ValidTo { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}

/// <summary>A price of a price list: the material in a unit, from a quantity on (0 = from the first unit).</summary>
[NotAudited("PriceListService logs the lines with the price list (the change of its lines).")]
[Table("erp_price_list_line")]
public class PriceListLine : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [References<PriceList>(BlocksDelete = false)]
    [Required, Column("price_list_code"), MaxLength(20)] public string PriceListCode { get; set; } = string.Empty;
    [References<Material>]
    [Required, Column("material_code"), MaxLength(50)] public string MaterialCode { get; set; } = string.Empty;
    [References<Uom>]
    [Required, Column("uom_code"), MaxLength(20)] public string UomCode { get; set; } = string.Empty;
    [Column("min_quantity", TypeName = "numeric(18,4)")] public decimal MinQuantity { get; set; }
    /// <summary>Price before tax in the currency of the price list.</summary>
    [Column("unit_price", TypeName = "numeric(18,4)")] public decimal UnitPrice { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
}
