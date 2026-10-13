using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Currencies;
using Core.Domain.Modules.Departments;
using Core.Domain.Modules.Inventory;

namespace Core.Domain.Modules.Inventory.Documents.IssueRequests;

/// <summary>
/// Phiếu yêu cầu xuất kho: a department asks the warehouse to issue goods. It goes through approval like any voucher but never
/// posts to the stock ledger; goods issues (inv_issue) pull the lines of an approved request and carry out the request.
/// </summary>
[Audited("inv_issue_request", "issueRequest", Label = "{Code}")]
[Table("erp_issue_request")]
public class IssueRequest : ErpEntity, IApprovableDocument
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("code"), MaxLength(64)] public string Code { get; set; } = string.Empty;
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [Column("document_date")] public DateOnly DocumentDate { get; set; }
    [Column("created_date")] public DateOnly CreatedDate { get; set; }
    /// <summary>The day the goods are needed (not before the voucher date).</summary>
    [Column("required_date")] public DateOnly? RequiredDate { get; set; }
    [References<Warehouse>]
    [Required, Column("warehouse_code"), MaxLength(20)] public string WarehouseCode { get; set; } = string.Empty;
    /// <summary>Purpose of the request (sale, production, sample...).</summary>
    [Required, Column("voucher_type"), MaxLength(100)] public string VoucherType { get; set; } = string.Empty;
    [References<Department>(Optional = true)]
    [Column("department_code"), MaxLength(20)] public string? DepartmentCode { get; set; }
    [Column("requester_name"), MaxLength(200)] public string? RequesterName { get; set; }
    [Column("customer_name"), MaxLength(200)] public string? CustomerName { get; set; }
    [References<Currency>]
    [Required, Column("currency_code"), MaxLength(10)] public string CurrencyCode { get; set; } = "VND";
    [Column("exchange_rate", TypeName = "numeric(18,6)")] public decimal ExchangeRate { get; set; } = 1;
    [Column("note"), MaxLength(1000)] public string? Note { get; set; }
    /// <summary>The project this voucher belongs to (dự án), optional: costs are added up per project.</summary>
    [References<Core.Domain.Modules.Purchasing.Categories.Projects.Project>(Optional = true)]
    [Column("project_code"), MaxLength(20)] public string? ProjectCode { get; set; }
    [Required, Column("status"), MaxLength(20)] public string Status { get; set; } = "Draft";
    [Column("total_value", TypeName = "numeric(18,2)")] public decimal TotalValue { get; set; }
    [Column("approved_by_user_id")] public int? ApprovedByUserId { get; set; }
    public List<IssueRequestLine> Lines { get; set; } = [];
}

[NotAudited("IssueRequestService attaches line changes to the parent request audit entry.")]
[Table("erp_issue_request_line")]
public class IssueRequestLine : ErpEntity
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Column("request_id")] public long RequestId { get; set; }
    [Column("line_no")] public int LineNo { get; set; }
    [References<Material>]
    [Required, Column("material_code"), MaxLength(64)] public string MaterialCode { get; set; } = string.Empty;
    /// <summary>The material name when the line was saved.</summary>
    [Required, Column("material_name"), MaxLength(200)] public string MaterialName { get; set; } = string.Empty;
    /// <summary>The unit the goods are asked in; the goods issue that carries the line out uses the same unit.</summary>
    [References<Uom>]
    [Required, Column("uom_code"), MaxLength(30)] public string UomCode { get; set; } = string.Empty;
    [Column("quantity", TypeName = "numeric(18,4)")] public decimal Quantity { get; set; }
    [Column("unit_price", TypeName = "numeric(18,4)")] public decimal UnitPrice { get; set; }
    [Column("amount", TypeName = "numeric(18,2)")] public decimal Amount { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
}
