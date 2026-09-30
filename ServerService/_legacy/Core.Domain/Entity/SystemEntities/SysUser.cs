using Core.Domain.Abstractions;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace Core.Domain.Entity.SystemEntities
{
    [Table(name: "sys_users", Schema = "public")]
    public class SysUser : AuditableImpl
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("user_id")]
        public int UserId { get; set; }

        [Required]
        [Column("user_name")]
        [StringLength(100)] // ud_name thường là 100 ký tự
        public string UserName { get; set; } = string.Empty;

        [Required]
        [Column("password_hash")]
        [StringLength(255)]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [Column("full_name")]
        [StringLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Column("ma_dvcs")]
        [StringLength(20)]
        public string MaDvcs { get; set; } = "DVCS01";

        [Column("email")]
        [StringLength(150)]
        public string? Email { get; set; }

        [Column("phone")]
        [StringLength(20)]
        public string? Phone { get; set; }

        [Column("department")]
        [StringLength(100)]
        public string Department { get; set; } = string.Empty;

        [Column("avatar")]
        public string Avatar { get; set; } = string.Empty;

        [Column("theme_pref")]
        [StringLength(10)]
        public string ThemePref { get; set; } = "light";

        [Column("notifications_enabled")]
        public bool NotificationsEnabled { get; set; } = true;

        [Column("security_version")]
        public int SecurityVersion { get; set; } = 1;

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("employee_code")]
        public string EmployeeCode { get; set; }
        
        [Column("auth_fl")]
        [MaxLength(25)]
        public string AuthFl { get; set; }

        [Column("enablefl")]
        public int EnableFl { get; set; }

        [Column("validflg")]
        public int ValidFlg { get; set; }
        
        [Column("gender")]
        public bool GenDer { get; set; }

        // Navigation properties
        public virtual ICollection<SysUserRole> UserRoles { get; set; } = new List<SysUserRole>();
        public virtual ICollection<SysUserCommand> UserPermissions { get; set; } = new List<SysUserCommand>();

        // Helper methods
        public bool IsAdmin()
        {
            return UserRoles?.Any(ur => ur.Role?.RoleName == "ADMIN") == true;
        }

        //public bool HasRole(string roleName)
        //{
        //    return UserRoles?.Any(ur => ur.Role?.RoleName == roleName && ur.IsRoleActive==true) == true;
        //}

        public void UpdateAuditFields(string userId, bool isCreate = false)
        {
            if (isCreate)
            {
                CreateTime = DateTime.UtcNow;
                CreateId = userId;
            }
            UpdateTime = DateTime.Now;
            UpdateId = userId;
        }
    }

    // Enum cho status nếu cần
    public enum UserStatus
    {
        A, // Active
        I, // Inactive
        L  // Locked
    }
}
