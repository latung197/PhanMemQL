using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Currencies;
using Core.Domain.Modules.Inventory;

namespace Core.Domain.Modules.Inventory.Documents.GoodsIssues;

[Audited("inv_issue", "goodsIssue", Label = "{Code}")]
[Table("erp_goods_issue")]
public class GoodsIssue : ErpEntity, IApprovableDocument
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("code"), MaxLength(64)] public string Code { get; set; } = string.Empty;
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [Column("document_date")] public DateOnly DocumentDate { get; set; }
    [Column("created_date")] public DateOnly CreatedDate { get; set; }
    [References<Warehouse>]
    [Required, Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    [Required, Column("voucher_type"), MaxLength(100)] public string VoucherType { get; set; } = string.Empty;
    [References<Currency>]
    [Required, Column("currency_code"), MaxLength(10)] public string CurrencyCode { get; set; } = "VND";
    [Column("exchange_rate", TypeName = "numeric(18,6)")] public decimal ExchangeRate { get; set; } = 1;
    [Column("customer_name"), MaxLength(200)] public string? CustomerName { get; set; }
    [Column("receiver_name"), MaxLength(200)] public string? ReceiverName { get; set; }
    /// <summary>The approved issue requests this issue carries out, comma separated and derived from the lines (lines point to request lines); empty for a free issue.</summary>
    [NotReference("trỏ tới mã phiếu yêu cầu xuất kho (khóa của nó là id); IssueRequestService không cho hủy phiếu yêu cầu còn phiếu xuất chưa hủy, và chỉ xóa được phiếu yêu cầu nháp")]
    [Column("issue_request_code"), MaxLength(500)] public string? IssueRequestCode { get; set; }
    [Column("note"), MaxLength(1000)] public string? Note { get; set; }
    [Required, Column("status"), MaxLength(20)] public string Status { get; set; } = "Draft";
    [Column("total_value", TypeName = "numeric(18,2)")] public decimal TotalValue { get; set; }
    [Column("approved_by_user_id")] public int? ApprovedByUserId { get; set; }
    public List<GoodsIssueLine> Lines { get; set; } = [];
}

[NotAudited("GoodsIssueService attaches line changes to the parent issue audit entry.")]
[Table("erp_goods_issue_line")]
public class GoodsIssueLine : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Column("issue_id")] public long IssueId { get; set; }
    [Required, Column("kind"), MaxLength(20)] public string Kind { get; set; } = "ITEM";
    [Column("line_no")] public int LineNo { get; set; }
    [References<Material>]
    [Required, Column("material_code"), MaxLength(64)] public string MaterialCode { get; set; } = string.Empty;
    /// <summary>The material name when the line was saved (what the printed voucher shows even if the catalog is renamed).</summary>
    [Required, Column("material_name"), MaxLength(200)] public string MaterialName { get; set; } = string.Empty;
    /// <summary>The unit of the line: the base unit of the material or one it converts from (<c>erp_uom_conversion</c>).</summary>
    [References<Uom>]
    [Required, Column("uom_code"), MaxLength(30)] public string UomCode { get; set; } = string.Empty;
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
    [Column("unit_price", TypeName = "numeric(18,4)")] public decimal UnitPrice { get; set; }
    [Column("amount", TypeName = "numeric(18,2)")] public decimal Amount { get; set; }
    [Column("lot_number"), MaxLength(64)] public string? LotNumber { get; set; }
    [Column("position"), MaxLength(100)] public string? Position { get; set; }
    /// <summary>The line of the issue request this line carries out (null on a free issue).</summary>
    [Column("issue_request_line_id")] public long? IssueRequestLineId { get; set; }
}
