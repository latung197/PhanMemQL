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
    [Table("sys_role")]
    public class SysRole:AuditableImpl
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("role_id")]
        public int RoleId { get; set; }

        [Required]
        [Column("role_name")]
        [StringLength(100)]
        public string RoleName { get; set; } = string.Empty;

        [Column("description")]
        public string? Description { get; set; }

        [Column("validflg")]
        public short ValidFlg { get; set; } = 1;

        // Navigation properties
        public virtual ICollection<SysUserRole> UserRoles { get; set; } = new List<SysUserRole>();
        public virtual ICollection<SysRoleCommand> RolePermissions { get; set; } = new List<SysRoleCommand>();

        // Helper methods
        public bool IsValid()
        {
            return ValidFlg == 1;
        }

        public void Deactivate()
        {
            ValidFlg = 0;
        }

        public void Activate()
        {
            ValidFlg = 1;
        }
    }
}
