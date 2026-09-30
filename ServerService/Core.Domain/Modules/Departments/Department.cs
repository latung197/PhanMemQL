using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Modules.Departments;

/// <summary>Phòng ban. Users and approval rules (requester type DEPARTMENT) link to it by code.</summary>
[Table("sys_department")]
public class Department
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(100)] public string Name { get; set; } = string.Empty;
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
