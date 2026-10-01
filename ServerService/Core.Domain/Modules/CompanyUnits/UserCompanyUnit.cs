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
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    public CompanyUnit Unit { get; set; } = null!;
}
