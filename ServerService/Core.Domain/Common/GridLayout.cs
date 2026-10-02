using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Common;

/// <summary>
/// How a list is shown for one user (or, with UserId null, the company default): visible columns, order, width,
/// sort and rows per page, as JSON written by the frontend. Columns are defined in the code, never here.
/// </summary>
[NotAudited("Display preference of a list, not business data.")]
[Table("sys_grid_layout")]
public class GridLayout
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity), Column("id")] public long Id { get; set; }
    [Required, Column("function_code"), MaxLength(64)] public string FunctionCode { get; set; } = string.Empty;
    [Required, Column("grid_key"), MaxLength(64)] public string GridKey { get; set; } = "main";
    [Column("user_id")] public int? UserId { get; set; }
    [Required, Column("layout", TypeName = "jsonb")] public string Layout { get; set; } = "{}";
    [Column("updated_at", TypeName = "timestamp with time zone")] public DateTime UpdatedAt { get; set; }
    [Column("updated_by")] public int? UpdatedBy { get; set; }
}
