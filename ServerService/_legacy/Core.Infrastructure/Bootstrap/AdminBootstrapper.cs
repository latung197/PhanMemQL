using Core.Application.Security;
using Core.Domain.Entity.Erp;
using Core.Domain.Entity.SystemEntities;
using Core.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Core.Infrastructure.Bootstrap;

/// <summary>Creates the first admin only when explicitly configured and the user table is empty.</summary>
public sealed class AdminBootstrapper(CoreContext db, IPasswordService passwords,
    IConfiguration configuration)
{
    public async Task RunAsync(CancellationToken ct = default)
    {
        var password = configuration["Bootstrap:AdminPassword"];
        if (string.IsNullOrEmpty(password)) return;
        if (password.Length < 12)
            throw new InvalidOperationException("Bootstrap:AdminPassword phải có ít nhất 12 ký tự.");
        if (await db.SysUser.AnyAsync(ct)) return;

        var username = configuration["Bootstrap:AdminUsername"]?.Trim() ?? "admin";
        var unitCode = configuration["Bootstrap:UnitCode"]?.Trim() ?? "DVCS01";
        var unitName = configuration["Bootstrap:UnitName"]?.Trim() ?? "Đơn vị cơ sở chính";
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(unitCode)
            || unitCode.Length > 20 || string.IsNullOrWhiteSpace(unitName) || unitName.Length > 150)
            throw new InvalidOperationException("Thông tin bootstrap quản trị không hợp lệ.");

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var unit = await db.ErpUnits.FindAsync([unitCode], ct);
        if (unit is null)
            db.ErpUnits.Add(new OrganizationUnit { Code = unitCode, Name = unitName });

        var role = await db.SysRole.FirstOrDefaultAsync(x => x.RoleName == "ADMIN", ct);
        if (role is null)
            db.SysRole.Add(role = new SysRole { RoleName = "ADMIN", ValidFlg = 1 });

        var user = new SysUser
        {
            UserName = username,
            FullName = "Quản trị hệ thống",
            MaDvcs = unitCode,
            EmployeeCode = "ADMIN",
            AuthFl = string.Empty,
            EnableFl = 1,
            ValidFlg = 1,
            IsActive = true
        };
        user.PasswordHash = passwords.Hash(user, password);
        db.SysUser.Add(user);
        await db.SaveChangesAsync(ct);
        db.SysUserRole.Add(new SysUserRole { UserId = user.UserId, RoleId = role.RoleId });
        db.ErpUserUnits.Add(new UserUnitAccess { UserId = user.UserId, UnitCode = unitCode });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
