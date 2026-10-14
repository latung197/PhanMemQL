using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;

namespace Core.Domain.Modules.Inventory.Documents.Transfers;

// Điều chuyển kho giữa hai kho của một đơn vị cơ sở: lệnh (không ghi sổ) → phiếu xuất (ghi sổ xuất kho đi) → phiếu nhập (ghi sổ nhập kho đến).

[Audited("inv_transfer_order", "transferOrder", Label = "{Code}")]
[Table("erp_transfer_order")]
public class TransferOrder : ErpEntity, IApprovableDocument
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("code"), MaxLength(64)] public string Code { get; set; } = string.Empty;
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [Column("document_date")] public DateOnly DocumentDate { get; set; }
    [Column("created_date")] public DateOnly CreatedDate { get; set; }
    [Column("required_date")] public DateOnly? RequiredDate { get; set; }
    [References<Warehouse>]
    [Required, Column("from_warehouse_code"), MaxLength(20)] public string FromWarehouseCode { get; set; } = string.Empty;
    [References<Warehouse>]
    [Required, Column("to_warehouse_code"), MaxLength(20)] public string ToWarehouseCode { get; set; } = string.Empty;
    /// <summary>Lý do điều chuyển.</summary>
    [Required, Column("reason"), MaxLength(100)] public string Reason { get; set; } = string.Empty;
    /// <summary>The person who asks for the transfer.</summary>
    [Column("person_name"), MaxLength(200)] public string? PersonName { get; set; }
    [Column("note"), MaxLength(1000)] public string? Note { get; set; }
    [Required, Column("status"), MaxLength(20)] public string Status { get; set; } = "Draft";
    /// <summary>Value of the goods in the base currency: from the stock ledger once the issue is posted, from the issue for a receipt; 0 for an order.</summary>
    [Column("total_value", TypeName = "numeric(18,2)")] public decimal TotalValue { get; set; }
    [Column("approved_by_user_id")] public int? ApprovedByUserId { get; set; }
    public List<TransferOrderLine> Lines { get; set; } = [];
}

[NotAudited("TransferOrderService attaches line changes to the parent voucher audit entry.")]
[Table("erp_transfer_order_line")]
public class TransferOrderLine : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Column("order_id")] public long OrderId { get; set; }
    [Column("line_no")] public int LineNo { get; set; }
    [References<Material>]
    [Required, Column("material_code"), MaxLength(64)] public string MaterialCode { get; set; } = string.Empty;
    [Required, Column("material_name"), MaxLength(200)] public string MaterialName { get; set; } = string.Empty;
    /// <summary>The unit of the line: the base unit of the material or one it converts from (<c>erp_uom_conversion</c>).</summary>
    [References<Uom>]
    [Required, Column("uom_code"), MaxLength(30)] public string UomCode { get; set; } = string.Empty;
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
}

[Audited("inv_transfer_issue", "transferIssue", Label = "{Code}")]
[Table("erp_transfer_issue")]
public class TransferIssue : ErpEntity, IApprovableDocument
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("code"), MaxLength(64)] public string Code { get; set; } = string.Empty;
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [Column("document_date")] public DateOnly DocumentDate { get; set; }
    [Column("created_date")] public DateOnly CreatedDate { get; set; }
    [References<Warehouse>]
    [Required, Column("from_warehouse_code"), MaxLength(20)] public string FromWarehouseCode { get; set; } = string.Empty;
    [References<Warehouse>]
    [Required, Column("to_warehouse_code"), MaxLength(20)] public string ToWarehouseCode { get; set; } = string.Empty;
    /// <summary>Lý do điều chuyển.</summary>
    [Required, Column("reason"), MaxLength(100)] public string Reason { get; set; } = string.Empty;
    /// <summary>The person who carries the goods (receiver / carrier).</summary>
    [Column("person_name"), MaxLength(200)] public string? PersonName { get; set; }
    /// <summary>The orders this voucher follows, comma separated and derived from the lines; empty for a free issue.</summary>
    [NotReference("trỏ tới số lệnh điều chuyển (khóa của nó là id); TransferOrderService không cho hủy lệnh còn phiếu xuất chưa hủy, và chỉ xóa được lệnh nháp")]
    [Column("transfer_order_code"), MaxLength(500)] public string? TransferOrderCode { get; set; }
    [Column("note"), MaxLength(1000)] public string? Note { get; set; }
    [Required, Column("status"), MaxLength(20)] public string Status { get; set; } = "Draft";
    /// <summary>Value of the goods in the base currency: from the stock ledger once the issue is posted, from the issue for a receipt; 0 for an order.</summary>
    [Column("total_value", TypeName = "numeric(18,2)")] public decimal TotalValue { get; set; }
    [Column("approved_by_user_id")] public int? ApprovedByUserId { get; set; }
    public List<TransferIssueLine> Lines { get; set; } = [];
}

[NotAudited("TransferIssueService attaches line changes to the parent voucher audit entry.")]
[Table("erp_transfer_issue_line")]
public class TransferIssueLine : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Column("issue_id")] public long IssueId { get; set; }
    [Column("line_no")] public int LineNo { get; set; }
    [References<Material>]
    [Required, Column("material_code"), MaxLength(64)] public string MaterialCode { get; set; } = string.Empty;
    [Required, Column("material_name"), MaxLength(200)] public string MaterialName { get; set; } = string.Empty;
    /// <summary>The unit of the line: the base unit of the material or one it converts from (<c>erp_uom_conversion</c>).</summary>
    [References<Uom>]
    [Required, Column("uom_code"), MaxLength(30)] public string UomCode { get; set; } = string.Empty;
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
    /// <summary>Value per unit of the line (base currency): set from the stock ledger on an issue, copied from the issue on a receipt.</summary>
    [Column("unit_price", TypeName = "numeric(18,4)")] public decimal UnitPrice { get; set; }
    [Column("amount", TypeName = "numeric(18,2)")] public decimal Amount { get; set; }
    [Column("lot_number"), MaxLength(64)] public string? LotNumber { get; set; }
    [Column("position"), MaxLength(100)] public string? Position { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    /// <summary>The line this line follows (null on a free issue).</summary>
    [Column("transfer_order_line_id")] public long? TransferOrderLineId { get; set; }
}

[Audited("inv_transfer_receipt", "transferReceipt", Label = "{Code}")]
[Table("erp_transfer_receipt")]
public class TransferReceipt : ErpEntity, IApprovableDocument
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("code"), MaxLength(64)] public string Code { get; set; } = string.Empty;
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [Column("document_date")] public DateOnly DocumentDate { get; set; }
    [Column("created_date")] public DateOnly CreatedDate { get; set; }
    [References<Warehouse>]
    [Required, Column("from_warehouse_code"), MaxLength(20)] public string FromWarehouseCode { get; set; } = string.Empty;
    [References<Warehouse>]
    [Required, Column("to_warehouse_code"), MaxLength(20)] public string ToWarehouseCode { get; set; } = string.Empty;
    /// <summary>Lý do điều chuyển.</summary>
    [Required, Column("reason"), MaxLength(100)] public string Reason { get; set; } = string.Empty;
    /// <summary>The person who delivered the goods to the destination warehouse.</summary>
    [Column("person_name"), MaxLength(200)] public string? PersonName { get; set; }
    /// <summary>The issues this voucher follows, comma separated and derived from the lines; empty for a free issue.</summary>
    [NotReference("trỏ tới số phiếu xuất điều chuyển (khóa của nó là id); TransferIssueService không cho bỏ ghi sổ phiếu xuất còn phiếu nhập chưa hủy, và chỉ xóa được phiếu xuất nháp")]
    [Column("transfer_issue_code"), MaxLength(500)] public string? TransferIssueCode { get; set; }
    [Column("note"), MaxLength(1000)] public string? Note { get; set; }
    [Required, Column("status"), MaxLength(20)] public string Status { get; set; } = "Draft";
    /// <summary>Value of the goods in the base currency: from the stock ledger once the issue is posted, from the issue for a receipt; 0 for an order.</summary>
    [Column("total_value", TypeName = "numeric(18,2)")] public decimal TotalValue { get; set; }
    [Column("approved_by_user_id")] public int? ApprovedByUserId { get; set; }
    public List<TransferReceiptLine> Lines { get; set; } = [];
}

[NotAudited("TransferReceiptService attaches line changes to the parent voucher audit entry.")]
[Table("erp_transfer_receipt_line")]
public class TransferReceiptLine : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Column("receipt_id")] public long ReceiptId { get; set; }
    [Column("line_no")] public int LineNo { get; set; }
    [References<Material>]
    [Required, Column("material_code"), MaxLength(64)] public string MaterialCode { get; set; } = string.Empty;
    [Required, Column("material_name"), MaxLength(200)] public string MaterialName { get; set; } = string.Empty;
    /// <summary>The unit of the line: the base unit of the material or one it converts from (<c>erp_uom_conversion</c>).</summary>
    [References<Uom>]
    [Required, Column("uom_code"), MaxLength(30)] public string UomCode { get; set; } = string.Empty;
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
    /// <summary>Value per unit of the line (base currency): set from the stock ledger on an issue, copied from the issue on a receipt.</summary>
    [Column("unit_price", TypeName = "numeric(18,4)")] public decimal UnitPrice { get; set; }
    [Column("amount", TypeName = "numeric(18,2)")] public decimal Amount { get; set; }
    [Column("lot_number"), MaxLength(64)] public string? LotNumber { get; set; }
    [Column("position"), MaxLength(100)] public string? Position { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    /// <summary>The line this line follows (null on a free issue).</summary>
    [Column("transfer_issue_line_id")] public long? TransferIssueLineId { get; set; }
}
