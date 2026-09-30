using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Core.Domain.Abstractions;

namespace Core.Domain.Entity.SystemEntities
{
    [Table("sys_role_command")]
    public class SysRoleCommand:AuditableImpl
    {
        [Key]
        [Column("role_id")]
        public int RoleId { get; set; }
        [Key]
        [Column("menuid0")]
        [StringLength(64)]
        public string MenuId0 { get; set; } = string.Empty;

        [Column("can_view")]
        public bool CanView { get; set; } = false;

        [Column("can_add")]
        public bool CanAdd { get; set; } = false;

        [Column("can_edit")]
        public bool CanEdit { get; set; } = false;

        [Column("can_delete")]
        public bool CanDelete { get; set; } = false;

        [Column("can_print")]
        public bool CanPrint { get; set; } = false;

        [Column("can_import")]
        public bool CanImport { get; set; } = false;

        [Column("can_export")]
        public bool CanExport { get; set; } = false;

        [Column("can_search")]
        public bool CanSearch { get; set; } = false;

        [Column("can_reload")]
        public bool CanReload { get; set; } = false;

        [Column("can_copy")]
        public bool CanCopy { get; set; } = false;

        [Column("can_approve")]
        public bool CanApprove { get; set; } = false;

        // Navigation properties
        [ForeignKey("RoleId")]
        public virtual SysRole Role { get; set; }

        [ForeignKey("MenuId0")]
        public virtual SysCommand Command { get; set; }

        // Helper methods
        public string GetActionsString()
        {
            var actions = new List<string>();

            if (CanView) actions.Add("R");
            if (CanAdd) actions.Add("C");
            if (CanEdit) actions.Add("U");
            if (CanDelete) actions.Add("D");
            if (CanPrint) actions.Add("P");
            if (CanImport) actions.Add("I");
            if (CanExport) actions.Add("E");
            if (CanCopy) actions.Add("Y");
            if (CanApprove) actions.Add("A");
            if (CanSearch) actions.Add("S");
            if (CanReload) actions.Add("L");

            return string.Join("", actions);
        }

        public void SetFromActionsString(string actions)
        {
            if (string.IsNullOrEmpty(actions)) return;

            CanView = actions.Contains("R");
            CanAdd = actions.Contains("C");
            CanEdit = actions.Contains("U");
            CanDelete = actions.Contains("D");
            CanPrint = actions.Contains("P");
            CanImport = actions.Contains("I");
            CanExport = actions.Contains("E");
            CanCopy = actions.Contains("Y");
            CanApprove = actions.Contains("A");
            CanSearch = actions.Contains("S");
            CanReload = actions.Contains("L");
        }

        public bool HasAnyPermission()
        {
            return CanView || CanAdd || CanEdit || CanDelete || CanPrint ||
                   CanImport || CanExport || CanSearch || CanReload || CanCopy || CanApprove;
        }

        public bool HasPermission(string action)
        {
            return action.ToUpper() switch
            {
                "R" => CanView,
                "C" => CanAdd,
                "U" => CanEdit,
                "D" => CanDelete,
                "P" => CanPrint,
                "I" => CanImport,
                "E" => CanExport,
                "S" => CanSearch,
                "L" => CanReload,
                "Y" => CanCopy,
                "A" => CanApprove,
                _ => false
            };
        }
    }
}
