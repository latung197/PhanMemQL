using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;

namespace Core.Domain.Modules.Approvals;

public static class ApprovalStepStatus
{
    /// <summary>Later level, waiting for the previous ones.</summary>
    public const string Waiting = "WAITING";
    /// <summary>Current level, waiting for one of its approvers.</summary>
    public const string Pending = "PENDING";
    public const string Approved = "APPROVED";
    public const string Rejected = "REJECTED";
    /// <summary>Not needed any more (document rejected, withdrawn or resubmitted).</summary>
    public const string Cancelled = "CANCELLED";
}

/// <summary>
/// One approval level of one submission of a document. The approvers are resolved from the rules when
/// the document is submitted and kept here, so later rule changes do not affect running approvals.
/// </summary>
[NotAudited("Logged on the document as SUBMIT / APPROVE / REJECT / WITHDRAW (DocumentApprovalService).")]
[Table("sys_document_approval")]
public class DocumentApproval
{
    [Key, Column("id"), DatabaseGenerated(DatabaseGeneratedOption.Identity)] public long Id { get; set; }
    [Required, Column("menuid0"), MaxLength(64)] public string MenuId0 { get; set; } = string.Empty;
    [Required, Column("document_id"), MaxLength(64)] public string DocumentId { get; set; } = string.Empty;
    [Column("document_title"), MaxLength(200)] public string? DocumentTitle { get; set; }
    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;
    [Column("amount", TypeName = "numeric(18,2)")] public decimal? Amount { get; set; }

    /// <summary>Groups the levels of one submission; a resubmission gets a new round.</summary>
    [Column("round")] public int Round { get; set; } = 1;
    [Column("level")] public int Level { get; set; }

    /// <summary>Comma-separated user ids allowed to act on this level.</summary>
    [Required, Column("approver_user_ids")] public string ApproverUserIds { get; set; } = string.Empty;
    [Column("approver_label"), MaxLength(300)] public string? ApproverLabel { get; set; }

    [Required, Column("status"), MaxLength(20)] public string Status { get; set; } = ApprovalStepStatus.Waiting;
    [Column("requested_by_user_id")] public int RequestedByUserId { get; set; }
    [Column("requested_at_utc")] public DateTime RequestedAtUtc { get; set; }
    [Column("acted_by_user_id")] public int? ActedByUserId { get; set; }
    [Column("acted_at_utc")] public DateTime? ActedAtUtc { get; set; }
    [Column("note"), MaxLength(1000)] public string? Note { get; set; }

    [NotMapped] public IReadOnlyList<int> ApproverIds =>
        ApproverUserIds.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList();
}
