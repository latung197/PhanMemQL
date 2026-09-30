using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Core.Application.Common.Security;
using Core.Domain.Modules.Users;
using Microsoft.IdentityModel.Tokens;

namespace Core.Infrastructure.Common.Security;

public sealed class JwtTokenService(JwtOptions options) : ITokenService
{
    public IssuedToken Issue(SysUser user, string unitCode)
    {
        var expires = DateTime.UtcNow.AddMinutes(options.LifetimeMinutes);
        var token = new JwtSecurityToken(options.Issuer, options.Audience,
        [
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim(ErpClaimTypes.UserName, user.UserName),
            new Claim(ErpClaimTypes.UnitCode, unitCode),
            new Claim(ErpClaimTypes.SecurityVersion, user.SecurityVersion.ToString())
        ], expires: expires,
            signingCredentials: new SigningCredentials(options.SigningKey, SecurityAlgorithms.HmacSha256));
        return new IssuedToken(new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
