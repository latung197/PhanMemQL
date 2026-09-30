using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Core.Domain.Abstractions
{
    public class AuditableImpl : IAuditable
    {
        [MaxLength(14)]
        [Column("createtime")]
        public DateTime? CreateTime { get; set; }
        [MaxLength(5)]
        [Column("createid")]
        public string? CreateId { get; set; }
        [MaxLength(14)]
        [Column("updatetime")]
        public DateTime? UpdateTime { get; set; }
        [MaxLength(5)]
        [Column("updateid")]
        public string? UpdateId { get; set; }
        [Column("status")]
        [StringLength(1)] // ud_status thường là 1 ký tự
        public string Status { get; set; } = "1"; // A: Active, I: Inactive
       
    }
}
