using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Core.Application.Features.Erp.Auth;
using Core.Application.Security;
using Core.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Core.Infrastructure.Features.Erp.Auth;

public sealed class ErpAuthService(CoreContext db, IPasswordService passwords,
    IAccessControlService access, IConfiguration configuration) : IErpAuthService
{
    public async Task<IReadOnlyList<ErpPlantOption>> GetLoginOptionsAsync(ErpLoginOptionsRequest request, CancellationToken ct)
    {
        var user = await AuthenticateAsync(request.Username, request.Password, ct);
        return await db.ErpUserPlants.AsNoTracking()
            .Where(x => x.UserId == user.UserId && x.Plant.IsActive && x.Plant.Unit.IsActive)
            .OrderBy(x => x.Plant.Unit.SortOrder).ThenBy(x => x.Plant.SortOrder)
            .Select(x => new ErpPlantOption(x.Plant.UnitCode, x.Plant.Unit.Name,
                x.PlantCode, x.Plant.Name)).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<ErpUnitOption>> GetUnitOptionsAsync(ErpLoginOptionsRequest request, CancellationToken ct)
    {
        var user = await AuthenticateAsync(request.Username, request.Password, ct);
        if (await access.IsAdminAsync(user.UserId, ct))
            return await db.ErpUnits.AsNoTracking().Where(x => x.IsActive)
                .OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
                .Select(x => new ErpUnitOption(x.Code, x.Name)).ToListAsync(ct);
        return await db.ErpUserUnits.AsNoTracking()
            .Where(x => x.UserId == user.UserId && x.Unit.IsActive)
            .OrderBy(x => x.Unit.SortOrder).ThenBy(x => x.UnitCode)
            .Select(x => new ErpUnitOption(x.UnitCode, x.Unit.Name)).ToListAsync(ct);
    }

    public async Task<ErpLoginResult> LoginAsync(ErpLoginRequest request, CancellationToken ct)
    {
        var user = await AuthenticateAsync(request.Username, request.Password, ct);
        if (!await HasActiveContextAsync(user.UserId, request.UnitCode, request.PlantCode, ct))
            throw new UnauthorizedAccessException("Tài khoản không có quyền vào nhà máy đã chọn.");

        var grants = await access.GetUserAccessAsync(user.UserId, ct);
        var signingKey = configuration["Tokens:Key"];
        if (string.IsNullOrWhiteSpace(signingKey) || Encoding.UTF8.GetByteCount(signingKey) < 32)
            throw new InvalidOperationException("Tokens:Key phải có ít nhất 32 byte.");

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim(ClaimTypeConst.USERNAME, user.UserName),
            new Claim(ErpClaimTypes.UnitCode, request.UnitCode),
            new Claim(ErpClaimTypes.SecurityVersion, user.SecurityVersion.ToString())
        };
        if (!string.IsNullOrWhiteSpace(request.PlantCode))
            claims.Add(new Claim(ErpClaimTypes.PlantCode, request.PlantCode));
        var minutes = int.TryParse(configuration["Tokens:LifetimeMinutes"], out var value)
            ? Math.Clamp(value, 5, 1440) : 480;
        var token = new JwtSecurityToken(configuration["Tokens:Issuer"], configuration["Tokens:Audience"],
            claims, expires: DateTime.UtcNow.AddMinutes(minutes),
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
                SecurityAlgorithms.HmacSha256));
        return new ErpLoginResult(user.UserId, user.UserName, user.FullName, request.UnitCode,
            request.PlantCode, new JwtSecurityTokenHandler().WriteToken(token), grants.IsAdmin,
            grants.EffectivePermissions);
    }

    public async Task<ErpProfile?> GetProfileAsync(int userId, string unitCode, CancellationToken ct)
    {
        var user = await db.SysUser.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId
            && x.ValidFlg == 1 && x.EnableFl == 1 && x.IsActive, ct);
        if (user is null) return null;
        var grants = await access.GetUserAccessAsync(userId, ct);
        var role = await db.SysUserRole.AsNoTracking()
            .Where(x => x.UserId == userId && x.Status == "1" && x.Role.ValidFlg == 1)
            .OrderBy(x => x.Role.RoleName)
            .Select(x => new { x.RoleId, x.Role.RoleName }).FirstOrDefaultAsync(ct);
        var units = grants.IsAdmin
            ? await db.ErpUnits.AsNoTracking().Where(x => x.IsActive)
                .OrderBy(x => x.SortOrder).Select(x => x.Code).ToListAsync(ct)
            : await db.ErpUserUnits.AsNoTracking().Where(x => x.UserId == userId && x.Unit.IsActive)
                .OrderBy(x => x.Unit.SortOrder).Select(x => x.UnitCode).ToListAsync(ct);
        var permissions = FrontendPermissionCatalog.Functions.Keys.ToDictionary(
            code => code, _ => new ErpActionPermissions(false, false, false, false, false),
            StringComparer.Ordinal);
        foreach (var grant in grants.EffectivePermissions.Where(x => permissions.ContainsKey(x.MenuId0)))
            permissions[grant.MenuId0] = new ErpActionPermissions(
                grant.CanView, grant.CanAdd || grant.CanEdit, grant.CanDelete,
                grant.CanApprove, grant.CanPrint || grant.CanExport);
        if (grants.IsAdmin)
            foreach (var code in FrontendPermissionCatalog.Functions.Keys)
                permissions[code] = new ErpActionPermissions(true, true, true, true, true);
        return new ErpProfile(user.UserId.ToString(), user.UserName, user.FullName,
            user.Email ?? string.Empty, grants.IsAdmin ? "ADMIN" : role?.RoleName ?? string.Empty,
            role?.RoleId.ToString(), user.Department, user.Phone ?? string.Empty, user.Avatar,
            user.ThemePref, user.NotificationsEnabled, grants.IsAdmin, permissions,
            unitCode, units);
    }

    public async Task<bool> HasActiveContextAsync(int userId, string unitCode, string? plantCode, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(unitCode)
            || !await db.ErpUnits.AsNoTracking().AnyAsync(x => x.Code == unitCode && x.IsActive, ct))
            return false;
        if (!string.IsNullOrWhiteSpace(plantCode))
            return await db.ErpUserPlants.AsNoTracking().AnyAsync(x => x.UserId == userId
                && x.PlantCode == plantCode && x.Plant.UnitCode == unitCode && x.Plant.IsActive, ct);
        if (await access.IsAdminAsync(userId, ct)) return true;
        return await db.ErpUserUnits.AsNoTracking().AnyAsync(x => x.UserId == userId
            && x.UnitCode == unitCode, ct);
    }

    private async Task<Core.Domain.Entity.SystemEntities.SysUser> AuthenticateAsync(
        string username, string password, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            throw new UnauthorizedAccessException("Tên đăng nhập hoặc mật khẩu không đúng.");
        var normalized = username.Trim().ToLower();
        var user = await db.SysUser.FirstOrDefaultAsync(x => x.UserName.ToLower() == normalized
            && x.ValidFlg == 1 && x.EnableFl == 1 && x.IsActive, ct);
        if (user is null || !passwords.Verify(user, password, out var needsUpgrade))
            throw new UnauthorizedAccessException("Tên đăng nhập hoặc mật khẩu không đúng.");
        if (needsUpgrade)
        {
            user.PasswordHash = passwords.Hash(user, password);
            await db.SaveChangesAsync(ct);
        }
        return user;
    }
}
