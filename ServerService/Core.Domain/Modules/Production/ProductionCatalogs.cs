using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Production;

/// <summary>Tổ sản xuất. An operation points to the team that carries it out with <c>production_team_code</c>.</summary>
[Audited("prod_team_cat", "productionTeam", Label = "{Code} - {Name}")]
[Table("erp_production_team")]
public class ProductionTeam : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}

/// <summary>
/// Công đoạn (thao tác) sản xuất. <c>RequireMachine</c>: the production report of the operation must name the machine;
/// <c>IsHeavy</c>: heavy work (công việc nặng nhọc).
/// </summary>
[Audited("prod_operation_cat", "productionOperation", Label = "{Code} - {Name}")]
[Table("erp_production_operation")]
public class ProductionOperation : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(200)] public string Name { get; set; } = string.Empty;
    [Column("name_en"), MaxLength(200)] public string? NameEn { get; set; }

    [References<ProductionTeam>(Optional = true)]
    [Column("production_team_code"), MaxLength(20)] public string? ProductionTeamCode { get; set; }

    [Column("require_machine")] public bool RequireMachine { get; set; }
    [Column("is_heavy")] public bool IsHeavy { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
