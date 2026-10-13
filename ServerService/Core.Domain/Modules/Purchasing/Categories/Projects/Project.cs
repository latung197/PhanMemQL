using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.Departments;

namespace Core.Domain.Modules.Purchasing.Categories.Projects;

/// <summary>
/// Dự án: a dimension the purchasing and stock vouchers point to with <c>project_code</c>, so that cost (and later revenue) can
/// be added up per project. Only a project that is planned or running takes new vouchers.
/// </summary>
[Audited("pur_project_cat", "project", Label = "{Code} - {Name}")]
[Table("erp_project")]
public class Project : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(200)] public string Name { get; set; } = string.Empty;
    /// <summary>The department in charge (optional).</summary>
    [References<Department>(Optional = true)]
    [Column("department_code"), MaxLength(20)] public string? DepartmentCode { get; set; }
    [Column("customer_name"), MaxLength(200)] public string? CustomerName { get; set; }
    [Column("manager_name"), MaxLength(100)] public string? ManagerName { get; set; }
    [Column("start_date")] public DateOnly? StartDate { get; set; }
    [Column("end_date")] public DateOnly? EndDate { get; set; }
    /// <summary>Planned cost in the base currency; the cost report compares the cost so far with it.</summary>
    [Column("budget", TypeName = "numeric(18,2)")] public decimal Budget { get; set; }
    /// <summary>PLANNING, ACTIVE, ONHOLD, DONE or CANCELLED; see <see cref="ProjectStatuses"/>.</summary>
    [Required, Column("status"), MaxLength(12)] public string Status { get; set; } = ProjectStatuses.Active;
    [Column("note"), MaxLength(500)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}

public static class ProjectStatuses
{
    public const string Planning = "PLANNING";
    public const string Active = "ACTIVE";
    public const string OnHold = "ONHOLD";
    public const string Done = "DONE";
    public const string Cancelled = "CANCELLED";
    public static readonly IReadOnlyList<string> All = [Planning, Active, OnHold, Done, Cancelled];

    /// <summary>A project in these statuses (and active) is offered on new vouchers.</summary>
    public static bool TakesVouchers(string status) => status is Planning or Active;
}
