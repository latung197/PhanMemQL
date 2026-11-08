using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;

namespace Core.Domain.Modules.Production;

/// <summary>
/// Quy trình sản xuất: the ordered list of production operations a product goes through. It is in force from
/// <c>EffectiveFrom</c> to <c>EffectiveTo</c> (null = no end) for the company units listed in erp_production_process_unit
/// (none listed = every unit); its operations are in erp_production_process_line.
/// </summary>
[Audited("prod_process_cat", "productionProcess", Label = "{Code} - {Name}")]
[Table("erp_production_process")]
public class ProductionProcess : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(200)] public string Name { get; set; } = string.Empty;
    [Column("name_en"), MaxLength(200)] public string? NameEn { get; set; }
    [Column("effective_from")] public DateOnly EffectiveFrom { get; set; }
    [Column("effective_to")] public DateOnly? EffectiveTo { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}

/// <summary>A company unit the process applies to. A process without rows here applies to every unit; the rows are logged on the process as the field "units".</summary>
[AuditedChild(typeof(ProductionProcess), nameof(ProcessCode), "units", nameof(UnitCode))]
[Table("erp_production_process_unit")]
public class ProductionProcessUnit : ErpEntity
{
    [References<ProductionProcess>(BlocksDelete = false)]
    [Column("production_process_code"), MaxLength(20)] public string ProcessCode { get; set; } = string.Empty;
    [References<CompanyUnit>]
    [Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
}

/// <summary>One step of a process: <c>LineNo</c> is its place (1, 2, 3...), the same operation may appear more than once. The steps are logged on the process as the field "operations" (by the service).</summary>
[NotAudited("the steps are rows edited in place; the service logs them on the process as one field, operations")]
[Table("erp_production_process_line")]
public class ProductionProcessLine : ErpEntity
{
    [References<ProductionProcess>(BlocksDelete = false)]
    [Column("production_process_code"), MaxLength(20)] public string ProcessCode { get; set; } = string.Empty;
    [Column("line_no")] public int LineNo { get; set; }
    [References<ProductionOperation>]
    [Column("production_operation_code"), MaxLength(20)] public string OperationCode { get; set; } = string.Empty;
}
