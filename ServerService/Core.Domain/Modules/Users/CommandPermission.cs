using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Users;

/// <summary>
/// Permission row of sys_role_command / sys_user_command. The table keeps eleven legacy flags;
/// the frontend works with five actions, so both directions are mapped here.
/// </summary>
public abstract class CommandPermission : AuditableEntity
{
    [Column("menuid0")] public string MenuId0 { get; set; } = string.Empty;
    [Column("can_view")] public bool CanView { get; set; }
    [Column("can_add")] public bool CanAdd { get; set; }
    [Column("can_edit")] public bool CanEdit { get; set; }
    [Column("can_delete")] public bool CanDelete { get; set; }
    [Column("can_print")] public bool CanPrint { get; set; }
    [Column("can_import")] public bool CanImport { get; set; }
    [Column("can_export")] public bool CanExport { get; set; }
    [Column("can_search")] public bool CanSearch { get; set; }
    [Column("can_reload")] public bool CanReload { get; set; }
    [Column("can_copy")] public bool CanCopy { get; set; }
    [Column("can_approve")] public bool CanApprove { get; set; }

    public ActionPermissions ToActions() => new(CanView, CanAdd || CanEdit, CanDelete,
        CanApprove, CanPrint || CanExport);

    public void SetActions(ActionPermissions actions)
    {
        CanView = CanSearch = CanReload = actions.View;
        CanAdd = CanEdit = CanCopy = CanImport = actions.CreateEdit;
        CanDelete = actions.Delete;
        CanApprove = actions.Approve;
        CanPrint = CanExport = actions.PrintExport;
    }
}
