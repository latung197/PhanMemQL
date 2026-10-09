using Core.Application.Common.Security;
using Microsoft.Extensions.Configuration;

namespace Core.Infrastructure.Common.Security;

/// <summary>Security:SuperAdmin of the configuration (default "admin", compared without case).</summary>
public sealed class ConfiguredSuperAdmin(IConfiguration configuration) : ISuperAdmin
{
    private readonly string _name = configuration["Security:SuperAdmin"]?.Trim() is { Length: > 0 } name ? name : "admin";

    public bool IsSuperAdminName(string? userName) =>
        !string.IsNullOrEmpty(userName) && string.Equals(userName, _name, StringComparison.OrdinalIgnoreCase);
}
