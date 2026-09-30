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
    [Table("sys_user_role")]
    public class SysUserRole:AuditableImpl
    {
        [Column("user_id")]
        public int UserId { get; set; }

        [Column("role_id")]
        public int RoleId { get; set; }

        // Navigation properties
        [ForeignKey("UserId")]
        public virtual SysUser User { get; set; }

        [ForeignKey("RoleId")]
        public virtual SysRole Role { get; set; }

        // Helper methods
        public bool IsUserActive()
        {
            return User?.IsActive == true;
        }

        public bool IsRoleActive()
        {
            return Role?.ValidFlg == 1;
        }
    }
}
