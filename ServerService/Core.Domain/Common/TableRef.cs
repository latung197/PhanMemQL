using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Common;

/// <summary>
/// One declared reference: <see cref="TableName"/>.<see cref="ColumnName"/> holds a code of <see cref="RefTable"/>.
/// Written at startup from the [References] attributes of the entities (never edited by hand), so it can be read
/// to see what points where. The view sys_v_columns joins it with the real columns of the database.
/// </summary>
[NotAudited("Derived from the entity attributes at every start.")]
[Table("sys_table_ref")]
public class TableRef
{
    [Column("table_name"), MaxLength(64)] public string TableName { get; set; } = string.Empty;
    [Column("column_name"), MaxLength(64)] public string ColumnName { get; set; } = string.Empty;
    [Required, Column("ref_table"), MaxLength(64)] public string RefTable { get; set; } = string.Empty;
    [Required, Column("ref_column"), MaxLength(64)] public string RefColumn { get; set; } = string.Empty;
    /// <summary>catalog (a catalog or a table others point to), translation, system (other sys_* table) or document.</summary>
    [Required, Column("table_kind"), MaxLength(16)] public string TableKind { get; set; } = string.Empty;
    [Column("blocks_delete")] public bool BlocksDelete { get; set; }
    [Column("optional")] public bool Optional { get; set; }
    [Required, Column("entity_type"), MaxLength(100)] public string EntityType { get; set; } = string.Empty;
    [Column("synced_at", TypeName = "timestamp with time zone")] public DateTime SyncedAt { get; set; }
}
