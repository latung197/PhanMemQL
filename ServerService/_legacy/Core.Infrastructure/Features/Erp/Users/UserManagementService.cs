using Core.Application.Features.Erp.Users;
using Core.Application.Security;
using Core.Domain.Entity.SystemEntities;
using Core.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Features.Erp.Users;

public sealed class UserManagementService(CoreContext db, IPasswordService passwords)
    : IUserManagementService
{
    public async Task<UserPage> SearchAsync(string? search, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.SysUser.AsNoTracking().Where(x => x.ValidFlg == 1);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => EF.Functions.ILike(x.UserName, $"%{term}%")
                || EF.Functions.ILike(x.FullName, $"%{term}%")
                || (x.Email != null && EF.Functions.ILike(x.Email, $"%{term}%")));
        }
        var total = await query.CountAsync(ct);
        var users = await query.OrderBy(x => x.UserName)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new UserPage(users.Select(ToDto).ToList(), total, page, pageSize);
    }

    public async Task<UserDto?> GetAsync(int userId, CancellationToken ct)
    {
        var user = await db.SysUser.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId
            && x.ValidFlg == 1, ct);
        return user is null ? null : ToDto(user);
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct)
    {
        ValidateUser(request.Username, request.FullName, request.EmployeeCode,
            request.DefaultUnitCode, request.ThemePref);
        ValidateContact(request.Email, request.Phone, request.Department, request.Avatar);
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            throw new ArgumentException("Mật khẩu phải có ít nhất 8 ký tự.");
        await ValidateUniqueAsync(request.Username, request.Email, request.EmployeeCode, 0, ct);
        await ValidateUnitAsync(request.DefaultUnitCode, ct);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var user = new SysUser
        {
            UserName = request.Username.Trim(), FullName = request.FullName.Trim(),
            Email = request.Email?.Trim(), Phone = request.Phone?.Trim(),
            Department = request.Department?.Trim() ?? string.Empty,
            Avatar = request.Avatar?.Trim() ?? string.Empty,
            ThemePref = request.ThemePref ?? "light",
            NotificationsEnabled = request.NotificationsEnabled,
            MaDvcs = request.DefaultUnitCode, EmployeeCode = request.EmployeeCode.Trim(),
            IsActive = true, EnableFl = 1, ValidFlg = 1, AuthFl = string.Empty
        };
        user.PasswordHash = passwords.Hash(user, request.Password);
        db.SysUser.Add(user);
        await db.SaveChangesAsync(ct);
        db.ErpUserUnits.Add(new Core.Domain.Entity.Erp.UserUnitAccess
        {
            UserId = user.UserId, UnitCode = request.DefaultUnitCode
        });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return ToDto(user);
    }

    public async Task<UserDto?> UpdateAsync(int userId, UpdateUserRequest request, CancellationToken ct)
    {
        ValidateUser("existing", request.FullName, request.EmployeeCode,
            request.DefaultUnitCode, request.ThemePref);
        ValidateContact(request.Email, request.Phone, request.Department, request.Avatar);
        var user = await db.SysUser.FirstOrDefaultAsync(x => x.UserId == userId && x.ValidFlg == 1, ct);
        if (user is null) return null;
        await ValidateUniqueAsync(user.UserName, request.Email, request.EmployeeCode, userId, ct);
        await ValidateUnitAsync(request.DefaultUnitCode, ct);
        user.FullName = request.FullName.Trim();
        user.Email = request.Email?.Trim();
        user.Phone = request.Phone?.Trim();
        user.Department = request.Department?.Trim() ?? string.Empty;
        user.Avatar = request.Avatar?.Trim() ?? string.Empty;
        user.ThemePref = request.ThemePref ?? "light";
        user.NotificationsEnabled = request.NotificationsEnabled;
        user.MaDvcs = request.DefaultUnitCode;
        user.EmployeeCode = request.EmployeeCode.Trim();
        user.IsActive = request.IsActive;
        user.EnableFl = request.IsActive ? 1 : 0;
        if (!await db.ErpUserUnits.AnyAsync(x => x.UserId == userId
            && x.UnitCode == request.DefaultUnitCode, ct))
            db.ErpUserUnits.Add(new Core.Domain.Entity.Erp.UserUnitAccess
            {
                UserId = userId, UnitCode = request.DefaultUnitCode
            });
        await db.SaveChangesAsync(ct);
        return ToDto(user);
    }

    public async Task<bool> DeleteAsync(int userId, int actorUserId, CancellationToken ct)
    {
        if (userId == actorUserId) throw new ArgumentException("Không thể xóa tài khoản của chính mình.");
        var user = await db.SysUser.FirstOrDefaultAsync(x => x.UserId == userId && x.ValidFlg == 1, ct);
        if (user is null) return false;
        user.ValidFlg = 0;
        user.IsActive = false;
        user.EnableFl = 0;
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task ChangeOwnPasswordAsync(int userId, ChangeOwnPasswordRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
            throw new ArgumentException("Mật khẩu mới phải có ít nhất 8 ký tự.");
        var user = await db.SysUser.FirstOrDefaultAsync(x => x.UserId == userId
            && x.ValidFlg == 1 && x.IsActive, ct)
            ?? throw new ArgumentException("Tài khoản không tồn tại.");
        if (!passwords.Verify(user, request.CurrentPassword, out _))
            throw new ArgumentException("Mật khẩu hiện tại không đúng.");
        user.PasswordHash = passwords.Hash(user, request.NewPassword);
        user.SecurityVersion++;
        await db.SaveChangesAsync(ct);
    }

    private async Task ValidateUnitAsync(string unitCode, CancellationToken ct)
    {
        if (!await db.ErpUnits.AnyAsync(x => x.Code == unitCode && x.IsActive, ct))
            throw new ArgumentException("Đơn vị cơ sở không tồn tại hoặc đã bị khóa.");
    }

    private async Task ValidateUniqueAsync(string username, string? email, string employeeCode,
        int exceptUserId, CancellationToken ct)
    {
        var normalized = username.Trim().ToLower();
        if (await db.SysUser.AnyAsync(x => x.UserId != exceptUserId && x.ValidFlg == 1
            && x.UserName.ToLower() == normalized, ct))
            throw new ArgumentException("Tên đăng nhập đã tồn tại.");
        if (!string.IsNullOrWhiteSpace(email))
        {
            var normalizedEmail = email.Trim().ToLower();
            if (await db.SysUser.AnyAsync(x => x.UserId != exceptUserId && x.ValidFlg == 1
                && x.Email != null && x.Email.ToLower() == normalizedEmail, ct))
                throw new ArgumentException("Email đã tồn tại.");
        }
        if (await db.SysUser.AnyAsync(x => x.UserId != exceptUserId && x.ValidFlg == 1
            && x.EmployeeCode == employeeCode.Trim(), ct))
            throw new ArgumentException("Mã nhân viên đã tồn tại.");
    }

    private static void ValidateUser(string username, string fullName, string employeeCode,
        string unitCode, string? themePref)
    {
        if (string.IsNullOrWhiteSpace(username) || username.Length > 100
            || string.IsNullOrWhiteSpace(fullName) || fullName.Length > 100
            || string.IsNullOrWhiteSpace(employeeCode) || employeeCode.Length > 50
            || string.IsNullOrWhiteSpace(unitCode) || unitCode.Length > 20
            || themePref is not (null or "light" or "dark"))
            throw new ArgumentException("Thông tin tài khoản không hợp lệ.");
    }

    private static void ValidateContact(string? email, string? phone, string? department,
        string? avatar)
    {
        if (email?.Length > 150 || phone?.Length > 20 || department?.Length > 100
            || avatar?.Length > 2000)
            throw new ArgumentException("Thông tin liên hệ vượt quá độ dài cho phép.");
    }

    private static UserDto ToDto(SysUser user) => new(user.UserId, user.UserName,
        user.FullName, user.Email ?? string.Empty, user.Phone ?? string.Empty,
        user.Department, user.Avatar, user.ThemePref, user.NotificationsEnabled,
        user.MaDvcs, user.EmployeeCode, user.IsActive);
}
