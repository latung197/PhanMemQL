using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;

namespace Core.Domain.Modules.Approvals;

public static class ApproverTypes
{
    public const string User = "USER";
    public const string Role = "ROLE";
}

public static class RequesterTypes
{
    public const string Any = "ANY";
    public const string User = "USER";
    public const string Role = "ROLE";
    public const string Department = "DEPARTMENT";
}

/// <summary>
/// "Documents of {function} created by {requester} in {unit}, from {min amount}, are approved at
/// {level} by {approver}". Rules of the same level are combined; levels are processed in order.
/// </summary>
[Audited("sys_users", "approvalRule", Label = "{MenuId0} #{Level}")]
[Table("sys_approval_rule")]
public class ApprovalRule : IVersioned
{
    /// <summary>Row version (xmin) against lost updates; see IVersioned.</summary>
    public uint Version { get; set; }

    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }

    /// <summary>Voucher function (SubMenuKey), e.g. inv_receipt.</summary>
    [AuditField("function"), Required, Column("menuid0"), MaxLength(64)] public string MenuId0 { get; set; } = string.Empty;

    /// <summary>Null = every company unit.</summary>
    [References<CompanyUnit>(Optional = true)]
    [Column("unit_code"), MaxLength(20)] public string? UnitCode { get; set; }

    [Column("level")] public int Level { get; set; } = 1;

    [Required, Column("requester_type"), MaxLength(20)] public string RequesterType { get; set; } = RequesterTypes.Any;
    [AuditIgnore, Column("requester_value"), MaxLength(100)] public string? RequesterValue { get; set; }

    /// <summary>The rule applies only from this amount (inclusive). Null = any amount.</summary>
    [Column("min_amount", TypeName = "numeric(18,2)")] public decimal? MinAmount { get; set; }

    [Required, Column("approver_type"), MaxLength(20)] public string ApproverType { get; set; } = ApproverTypes.Role;
    [AuditIgnore, Required, Column("approver_value"), MaxLength(100)] public string ApproverValue { get; set; } = string.Empty;

    [Column("note"), MaxLength(500)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [AuditIgnore, Column("updated_at_utc")] public DateTime UpdatedAtUtc { get; set; }
    [AuditIgnore, Column("updated_by_user_id")] public int UpdatedByUserId { get; set; }
}
