using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Security;
using Core.Application.Common.Validation;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Users;

public sealed class UserService(CoreContext db, IPasswordService passwords, IPermissionService permissions,
    UserProfileBuilder profiles, UserAccessWriter access, IUnitOfWork unitOfWork, GrantGuard grants) : IUserService
{
    /// <summary>Same rule as the frontend form (UserAccountModals).</summary>
    private static readonly System.Text.RegularExpressions.Regex UsernamePattern = new("^[a-z0-9._-]{3,50}$");

    public async Task<IReadOnlyList<UserProfileDto>> GetAllAsync(CancellationToken ct)
    {
        var users = await db.Users.AsNoTracking().NotDeleted().OrderBy(x => x.UserName).ToListAsync(ct);
        return await profiles.BuildAsync(users, null, ct);
    }

    public async Task<UserProfileDto> GetProfileAsync(int userId, string unitCode, CancellationToken ct) =>
        await profiles.BuildAsync(await FindAsync(userId, ct), unitCode, ct);

    public async Task<UserProfileDto> CreateAsync(int actorUserId, CreateUserRequest request, CancellationToken ct)
    {
        var username = Guard.Required(request.Username, 50, "tên đăng nhập").ToLowerInvariant();
        if (!UsernamePattern.IsMatch(username))
            throw new BusinessRuleException("Tên đăng nhập từ 3–50 ký tự, chỉ gồm chữ thường không dấu, số và . _ -");
        PasswordPolicy.Validate(request.Password);
        var user = new SysUser { UserName = username };
        ApplyContact(user, request.FullName, request.Email, request.Phone, request.Avatar);
        await ApplyDepartmentAsync(user, request.DepartmentCode, ct);
        user.EmployeeCode = Guard.Optional(request.EmployeeCode, 50, "Mã nhân viên") ?? string.Empty;
        await EnsureUniqueAsync(user, ct);
        var units = await access.ResolveUnitsAsync(request.MaDvcs, request.DsMaDvcs, ct);
        user.MaDvcs = units[0];
        var role = await FindRoleAsync(request.RoleId, ct);
        await EnsureActorMayManageAsync(actorUserId, null, role, ct);
        PermissionMatrix.EnsureKnownCodes(request.Permissions);
        // The user gets the role rights; given permissions become exceptions to them.
        var roleMatrix = await access.RoleMatrixAsync(role, ct);
        var overrides = role?.IsAdmin == true || request.Permissions is null ? []
            : PermissionMatrix.Overrides(roleMatrix, request.Permissions);
        await grants.EnsureCanGrantAsync(actorUserId, null, Apply(roleMatrix, overrides), null,
            await access.RoleRightsAsync(role, ct), ct);
        await grants.EnsureCanAssignUnitsAsync(actorUserId, [], units, ct);
        user.PasswordHash = passwords.Hash(user, request.Password);

        await unitOfWork.ExecuteAsync(async token =>
        {
            db.Users.Add(user);
            await db.SaveChangesAsync(token);
            await access.ReplaceUnitsAsync(user.UserId, units, token);
            await access.ReplaceRoleAsync(user.UserId, role, token);
            await access.ReplaceMatrixOverridesAsync(user.UserId, overrides, token);
            await db.SaveChangesAsync(token);
        }, ct);
        return await profiles.BuildAsync(user, null, ct);
    }

    public async Task<UserProfileDto> UpdateAsync(int actorUserId, int userId, UpdateUserRequest request,
        CancellationToken ct)
    {
        var user = await FindAsync(userId, ct);
        await EnsureActorMayManageAsync(actorUserId, userId, null, ct);
        if (!request.IsActive && user.IsActive)
        {
            if (userId == actorUserId) throw new BusinessRuleException("Không thể khóa tài khoản đang đăng nhập.");
            await EnsureNotLastAdminAsync(userId, ct);
        }
        ApplyContact(user, request.FullName, request.Email, request.Phone, request.Avatar);
        await ApplyDepartmentAsync(user, request.DepartmentCode, ct);
        user.ThemePref = request.ThemePref is "dark" ? "dark" : "light";
        user.NotificationsEnabled = request.NotificationsEnabled;
        user.EmployeeCode = Guard.Optional(request.EmployeeCode, 50, "Mã nhân viên") ?? string.Empty;
        await EnsureUniqueAsync(user, ct);
        var units = await access.ResolveUnitsAsync(request.MaDvcs, request.DsMaDvcs, ct);
        var currentUnits = await db.UserCompanyUnits.AsNoTracking().Where(x => x.UserId == userId)
            .Select(x => x.UnitCode).ToListAsync(ct);
        await grants.EnsureCanAssignUnitsAsync(actorUserId, currentUnits, units, ct);
        user.MaDvcs = units[0];
        if (user.IsActive != request.IsActive) user.SecurityVersion++;
        user.IsActive = request.IsActive;
        user.EnableFl = request.IsActive ? 1 : 0;

        await access.ReplaceUnitsAsync(userId, units, ct);
        await db.SaveChangesAsync(ct);
        return await profiles.BuildAsync(user, null, ct);
    }

    public async Task<UserProfileDto> SetPermissionsAsync(int actorUserId, int userId,
        SetUserPermissionsRequest request, CancellationToken ct)
    {
        var user = await FindAsync(userId, ct);
        var role = await FindRoleAsync(request.RoleId, ct);
        await EnsureActorMayManageAsync(actorUserId, userId, role, ct);
        await grants.EnsureNotSelfAsync(actorUserId, userId, ct);
        PermissionMatrix.EnsureKnownCodes(request.Permissions);
        PermissionMatrix.EnsureKnownRights(request.SpecialRights);
        await grants.EnsureCanGrantAsync(actorUserId, await permissions.GetEffectiveAsync(userId, ct), request.Permissions,
            await permissions.GetRightsAsync(userId, ct), request.SpecialRights, ct);
        if (role?.IsAdmin != true && !UserQueries.IsLegacyAdmin(user.AuthFl))
            await EnsureNotLastAdminAsync(userId, ct);

        // The request carries the wanted rights; only what differs from the (new) role is stored, so later
        // changes of the role still reach the functions and rights the user was not given exceptions for.
        await access.ReplaceRoleAsync(userId, role, ct);
        if (role?.IsAdmin == true)
            await access.ClearOverridesAsync(userId, ct);
        else
        {
            await access.ReplaceMatrixOverridesAsync(userId,
                PermissionMatrix.Overrides(await access.RoleMatrixAsync(role, ct), request.Permissions), ct);
            if (request.SpecialRights is not null)
            {
                var (granted, denied) = PermissionMatrix.RightOverrides(await access.RoleRightsAsync(role, ct), request.SpecialRights);
                await access.ReplaceRightOverridesAsync(userId, granted, denied, ct);
            }
        }
        await db.SaveChangesAsync(ct);
        return await profiles.BuildAsync(user, null, ct);
    }

    /// <summary>The role matrix with the exceptions applied (what the user will have).</summary>
    private static Dictionary<string, ActionPermissions> Apply(IReadOnlyDictionary<string, ActionPermissions> roleMatrix,
        IReadOnlyDictionary<string, ActionPermissions> overrides)
    {
        var result = new Dictionary<string, ActionPermissions>(roleMatrix, StringComparer.Ordinal);
        foreach (var (code, actions) in overrides) result[code] = actions;
        return result;
    }

    public async Task ResetPasswordAsync(int actorUserId, int userId, ResetPasswordRequest request,
        CancellationToken ct)
    {
        if (userId == actorUserId)
            throw new BusinessRuleException("Hãy dùng \"Đổi mật khẩu\" trong menu tài khoản để đổi mật khẩu của chính mình.");
        PasswordPolicy.Validate(request.NewPassword);
        var user = await FindAsync(userId, ct);
        await EnsureActorMayManageAsync(actorUserId, userId, null, ct);
        user.PasswordHash = passwords.Hash(user, request.NewPassword);
        user.SecurityVersion++;
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(int actorUserId, int userId, CancellationToken ct)
    {
        if (userId == actorUserId) throw new BusinessRuleException("Không thể xóa tài khoản đang đăng nhập.");
        var user = await FindAsync(userId, ct);
        await EnsureActorMayManageAsync(actorUserId, userId, null, ct);
        await EnsureNotLastAdminAsync(userId, ct);
        user.ValidFlg = 0;
        user.IsActive = false;
        user.EnableFl = 0;
        user.SecurityVersion++;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Holders of "sys_users" rights may manage ordinary accounts; administrator accounts and the
    /// ADMIN role are reserved to administrators, so nobody can raise their own rights.
    /// </summary>
    private async Task EnsureActorMayManageAsync(int actorUserId, int? targetUserId, SysRole? newRole,
        CancellationToken ct)
    {
        var touchesAdmin = newRole?.IsAdmin == true
            || (targetUserId is int id && await IsAdminAccountAsync(id, ct));
        if (touchesAdmin) await permissions.EnsureAdminAsync(actorUserId, ct);
    }

    /// <summary>Admin by role or legacy flag, whether or not the account is currently active.</summary>
    private async Task<bool> IsAdminAccountAsync(int userId, CancellationToken ct)
    {
        var authFl = await db.Users.AsNoTracking().Where(x => x.UserId == userId)
            .Select(x => x.AuthFl).FirstOrDefaultAsync(ct);
        return UserQueries.IsLegacyAdmin(authFl) || await db.UserRoles.AnyAsync(x => x.UserId == userId
            && x.Status == "1" && x.Role.RoleCode == SysRole.AdminCode, ct);
    }

    private async Task<SysUser> FindAsync(int userId, CancellationToken ct) =>
        await db.Users.NotDeleted().FirstOrDefaultAsync(x => x.UserId == userId, ct)
        ?? throw new NotFoundException("Người dùng không tồn tại.");

    private async Task<SysRole?> FindRoleAsync(string? roleId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(roleId)) return null;
        if (!int.TryParse(roleId, out var id)) throw new BusinessRuleException("Vai trò không hợp lệ.");
        return await db.Roles.AsNoTracking().Include(x => x.Permissions)
            .FirstOrDefaultAsync(x => x.RoleId == id && x.ValidFlg == 1, ct)
            ?? throw new BusinessRuleException("Vai trò không tồn tại hoặc đã ngừng sử dụng.");
    }

    private static void ApplyContact(SysUser user, string fullName, string? email, string? phone, string? avatar)
    {
        user.FullName = Guard.Required(fullName, 100, "họ tên");
        user.Email = Guard.Optional(email, 150, "Email");
        user.Phone = Guard.Optional(phone, 20, "Số điện thoại");
        user.Avatar = Guard.Optional(avatar, 2000, "Ảnh đại diện") ?? string.Empty;
    }

    /// <summary>Links the user to an active department; the name is copied for display.</summary>
    private async Task ApplyDepartmentAsync(SysUser user, string? departmentCode, CancellationToken ct)
    {
        var code = Guard.Optional(departmentCode, 20, "Phòng ban")?.ToUpperInvariant();
        if (code is null)
        {
            user.DepartmentCode = null;
            user.Department = string.Empty;
            return;
        }
        if (code == user.DepartmentCode) return; // may stay in a department that was set inactive later
        var department = await db.Departments.AsNoTracking().FirstOrDefaultAsync(x => x.Code == code && x.IsActive, ct)
            ?? throw new BusinessRuleException("Phòng ban không tồn tại hoặc đã ngừng sử dụng.");
        user.DepartmentCode = department.Code;
        user.Department = department.Name;
    }

    private async Task EnsureUniqueAsync(SysUser user, CancellationToken ct)
    {
        var others = db.Users.AsNoTracking().NotDeleted().Where(x => x.UserId != user.UserId);
        if (await others.AnyAsync(x => x.UserName.ToLower() == user.UserName.ToLower(), ct))
            throw new BusinessRuleException("Tên đăng nhập đã tồn tại.");
        if (user.Email is { } email && await others.AnyAsync(x => x.Email != null
                && x.Email.ToLower() == email.ToLower(), ct))
            throw new BusinessRuleException("Email đã được dùng cho tài khoản khác.");
        if (user.EmployeeCode.Length > 0 && await others.AnyAsync(x => x.EmployeeCode == user.EmployeeCode, ct))
            throw new BusinessRuleException("Mã nhân viên đã tồn tại.");
    }

    /// <summary>Keeps at least one active administrator in the system.</summary>
    private async Task EnsureNotLastAdminAsync(int userId, CancellationToken ct)
    {
        if (!await permissions.IsAdminAsync(userId, ct)) return;
        var candidates = await db.Users.AsNoTracking().ActiveUsers().Where(x => x.UserId != userId)
            .Select(x => new
            {
                x.AuthFl,
                HasAdminRole = db.UserRoles.Any(r => r.UserId == x.UserId && r.Status == "1"
                    && r.Role.ValidFlg == 1 && r.Role.RoleCode == SysRole.AdminCode)
            }).ToListAsync(ct);
        if (!candidates.Any(x => x.HasAdminRole || UserQueries.IsLegacyAdmin(x.AuthFl)))
            throw new BusinessRuleException("Hệ thống phải còn ít nhất một quản trị viên đang hoạt động.");
    }
}
