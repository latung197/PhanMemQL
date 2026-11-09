using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.CompanyUnits;

/// <summary>Company unit a user may sign in to (ds_ma_dvcs).</summary>
[AuditedChild(typeof(Users.SysUser), nameof(UserId), "units", nameof(UnitCode))]
[Table("sys_user_company_unit")]
public class UserCompanyUnit
{
    [Column("user_id")] public int UserId { get; set; }
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    /// <summary>The role of the user in this unit; null = the user's default role (sys_user_role). Never the ADMIN role.</summary>
    [Column("role_id")] public int? RoleId { get; set; }
    public CompanyUnit Unit { get; set; } = null!;
}
