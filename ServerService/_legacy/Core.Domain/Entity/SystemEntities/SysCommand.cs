using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Domain.Entity.SystemEntities
{
    [Table("sys_command")]
    public class SysCommand
    {
        [Key]
        [Column("menuid0")]
        [StringLength(64)]
        public string MenuId0 { get; set; } = string.Empty;

        [Column("menuid")]
        [StringLength(64)]
        public string MenuId { get; set; } = string.Empty;

        [Column("text")]
        [StringLength(100)] // ud_name thường là 100 ký tự
        public string Text { get; set; } = string.Empty;

        [Column("text2")]
        [StringLength(100)]
        public string Text2 { get; set; } = string.Empty;

        [Column("ma_ct")]
        [StringLength(3)] // ud_char3 là 3 ký tự
        public string MaCt { get; set; } = string.Empty;

        [Column("report")]
        [StringLength(100)]
        public string Report { get; set; } = string.Empty;

        [Column("command")]
        [StringLength(100)]
        public string Command { get; set; } = string.Empty;

        [Column("title")]
        public string Title { get; set; } = string.Empty;

        [Column("title2")]
        public string Title2 { get; set; } = string.Empty;

        [Column("basicright")]
        public short BasicRight { get; set; } = 0;

        [Column("picture1")]
        public string Picture1 { get; set; } = string.Empty;

        [Column("picture2")]
        public string Picture2 { get; set; } = string.Empty;

        [Column("type")]
        [StringLength(3)] // ud_char3 là 3 ký tự
        public string Type { get; set; } = string.Empty;

        [Column("sysid")]
        [StringLength(50)] // ud_id thường là 50 ký tự
        public string SysId { get; set; } = string.Empty;

        [Column("syscode")]
        [StringLength(50)]
        public string SysCode { get; set; } = string.Empty;

        [Column("hide_yn")]
        public short HideYn { get; set; } = 0;

        [Column("hide_yn2")]
        public short? HideYn2 { get; set; }

        [Column("ds_dvcs")]
        public string DsDvcs { get; set; } = string.Empty;

        // Navigation properties
        public virtual ICollection<SysRoleCommand> RoleCommands { get; set; } = new List<SysRoleCommand>();
        public virtual ICollection<SysUserCommand> UserCommands { get; set; } = new List<SysUserCommand>();

        // NotMapped properties cho UI
        [NotMapped]
        public List<SysCommand> Children { get; set; } = new List<SysCommand>();

        [NotMapped]
        public bool HasChildren => Children?.Count > 0;

        [NotMapped]
        public bool IsExpanded { get; set; }

        [NotMapped]
        public bool IsSelected { get; set; }

        // Helper methods
        public bool IsVisible()
        {
            return HideYn == 0 && (HideYn2 == null || HideYn2 == 0);
        }

        public bool IsGroup()
        {
            return Type?.ToUpper() == "G" || string.IsNullOrEmpty(Command);
        }

        public bool IsModule()
        {
            return string.IsNullOrEmpty(MenuId) || MenuId == "";
        }

        public string GetDisplayText()
        {
            return !string.IsNullOrEmpty(Text) ? Text : Command;
        }

        public string GetDisplayText2()
        {
            return !string.IsNullOrEmpty(Text2) ? Text2 : Text;
        }

        public bool IsAllowedForDvcs(string maDvcs)
        {
            if (string.IsNullOrEmpty(DsDvcs) || string.IsNullOrEmpty(maDvcs))
                return true;

            var dvcsList = DsDvcs.Split(',', StringSplitOptions.RemoveEmptyEntries);
            return dvcsList.Contains(maDvcs.Trim());
        }
    }
}
