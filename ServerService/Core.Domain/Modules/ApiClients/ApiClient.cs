using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;
using Core.Domain.Modules.CompanyUnits;

namespace Core.Domain.Modules.ApiClients;

/// <summary>
/// A machine that calls the API with a key (header X-Api-Key). It acts as its service account (<see cref="UserId"/>) in one company
/// unit, so its rights are the account's rights. Only the hash of the key is stored.
/// </summary>
[Audited("sys_users", "apiClient", Label = "{Code} - {Name}")]
[Table("sys_api_client")]
public class ApiClient : ErpEntity
{
    [Key, Column("code"), MaxLength(30)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(200)] public string Name { get; set; } = string.Empty;

    /// <summary>The service account (sys_users.user_id) whose rights the key has.</summary>
    [Column("user_id")] public int UserId { get; set; }

    [References<CompanyUnit>]
    [Required, Column("unit_code"), MaxLength(20)] public string UnitCode { get; set; } = string.Empty;

    /// <summary>Which APIs the key may call, see <see cref="ApiKeyScopes"/>.</summary>
    [Required, Column("scope"), MaxLength(20)] public string Scope { get; set; } = ApiKeyScopes.Transfer;

    [Column("key_prefix"), MaxLength(10)] public string KeyPrefix { get; set; } = string.Empty;
    [AuditIgnore, Column("key_hash"), MaxLength(64)] public string KeyHash { get; set; } = string.Empty;

    /// <summary>Addresses or CIDR ranges separated by commas; empty = any address.</summary>
    [Column("allowed_ips"), MaxLength(500)] public string? AllowedIps { get; set; }
    [Column("expires_at")] public DateTime? ExpiresAt { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;

    [AuditIgnore, Column("last_used_at")] public DateTime? LastUsedAt { get; set; }
    [AuditIgnore, Column("last_used_ip"), MaxLength(50)] public string? LastUsedIp { get; set; }
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
}

/// <summary>What an API key may call. A scope is a list of path prefixes (<c>ApiKeyRules.Allows</c>), never the admin screens.</summary>
public static class ApiKeyScopes
{
    /// <summary>The three warehouse transfer vouchers (order, issue, receipt) and the lookups their forms read.</summary>
    public const string Transfer = "TRANSFER";
    public static readonly IReadOnlyList<string> All = [Transfer];
}
