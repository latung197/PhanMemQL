using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Core.Infrastructure.Common.Security;

/// <summary>"Tokens" configuration section, validated once at startup.</summary>
public sealed class JwtOptions
{
    public required string Issuer { get; init; }
    public required string Audience { get; init; }
    public required SymmetricSecurityKey SigningKey { get; init; }
    public int LifetimeMinutes { get; init; }

    public static JwtOptions FromConfiguration(IConfiguration configuration)
    {
        var section = configuration.GetSection("Tokens");
        var key = section["Key"];
        if (string.IsNullOrWhiteSpace(key) || Encoding.UTF8.GetByteCount(key) < 32)
            throw new InvalidOperationException("Tokens:Key phải có ít nhất 32 byte (đặt trong appsettings.Local.json).");
        var lifetime = int.TryParse(section["LifetimeMinutes"], out var minutes) ? minutes : 480;
        return new JwtOptions
        {
            Issuer = section["Issuer"] ?? "erp-backend",
            Audience = section["Audience"] ?? "erp-frontend",
            SigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            LifetimeMinutes = Math.Clamp(lifetime, 5, 1440)
        };
    }
}
