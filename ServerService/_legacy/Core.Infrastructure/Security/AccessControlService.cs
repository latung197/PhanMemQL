using Core.Application.Security;
using Core.Domain.Entity.SystemEntities;
using Core.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Security;

public sealed class AccessControlService(CoreContext db) : IAccessControlService
{
    public Task<bool> IsActiveAsync(int userId, CancellationToken ct = default) =>
        db.SysUser.AsNoTracking().AnyAsync(x => x.UserId == userId && x.ValidFlg == 1
            && x.EnableFl == 1 && x.IsActive, ct);

    public Task<bool> IsTokenCurrentAsync(int userId, int securityVersion, CancellationToken ct = default) =>
        db.SysUser.AsNoTracking().AnyAsync(x => x.UserId == userId && x.ValidFlg == 1
            && x.EnableFl == 1 && x.IsActive && x.SecurityVersion == securityVersion, ct);

    public async Task<bool> IsAdminAsync(int userId, CancellationToken ct = default)
    {
        var user = await db.SysUser.AsNoTracking().FirstOrDefaultAsync(
            x => x.UserId == userId && x.ValidFlg == 1 && x.EnableFl == 1 && x.IsActive, ct);
        if (user is null) return false;

        // Legacy admin accounts use auth_fl=0. Keep this path during migration.
        if ((user.AuthFl ?? string.Empty).Split(',', StringSplitOptions.TrimEntries).Contains("0"))
            return true;

        return await db.SysUserRole.AsNoTracking().AnyAsync(x => x.UserId == userId && x.Status == "1"
            && x.Role.ValidFlg == 1 && x.Role.RoleName == "ADMIN", ct);
    }

    public async Task<bool> HasPermissionAsync(int userId, string menuId0, string action, CancellationToken ct = default)
    {
        if (await IsAdminAsync(userId, ct)) return true;
        if (!await IsActiveAsync(userId, ct)) return false;

        var grants = await db.SysRoleCommand.AsNoTracking()
            .Where(x => x.MenuId0 == menuId0 && x.Status == "1" && x.Role.ValidFlg == 1
                && db.SysUserRole.Any(ur => ur.UserId == userId && ur.RoleId == x.RoleId && ur.Status == "1"))
            .ToListAsync(ct);
        if (grants.Any(x => x.HasPermission(action))) return true;

        var individual = await db.SysUserCommand.AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId && x.MenuId0 == menuId0 && x.Status == "1", ct);
        return individual?.HasPermission(action) == true;
    }

    public async Task<UserAccessDto> GetUserAccessAsync(int userId, CancellationToken ct = default)
    {
        var result = new UserAccessDto();
        if (!await IsActiveAsync(userId, ct)) return result;
        result.IsAdmin = await IsAdminAsync(userId, ct);

        result.RoleIds = await db.SysUserRole.AsNoTracking()
            .Where(x => x.UserId == userId && x.Status == "1" && x.Role.ValidFlg == 1)
            .Select(x => x.RoleId).ToListAsync(ct);
        var roleIds = result.RoleIds;
        var roleGrants = await db.SysRoleCommand.AsNoTracking()
            .Where(x => roleIds.Contains(x.RoleId) && x.Status == "1").ToListAsync(ct);
        var personalGrants = await db.SysUserCommand.AsNoTracking()
            .Where(x => x.UserId == userId && x.Status == "1").ToListAsync(ct);
        result.IndividualPermissions = personalGrants.Select(ToDto).ToList();

        var merged = new Dictionary<string, PermissionGrantDto>(StringComparer.Ordinal);
        foreach (var grant in roleGrants.Select(ToDto).Concat(result.IndividualPermissions))
        {
            if (!merged.TryGetValue(grant.MenuId0, out var effective))
                merged[grant.MenuId0] = effective = new PermissionGrantDto { MenuId0 = grant.MenuId0 };
            effective.Add(grant);
        }
        result.EffectivePermissions = merged.Values.OrderBy(x => x.MenuId0).ToList();
        return result;
    }

    public async Task<IReadOnlyList<CommandDto>> GetCommandsAsync(CancellationToken ct = default) =>
        await db.SysCommand.AsNoTracking().OrderBy(x => x.MenuId0)
            .Select(x => new CommandDto(x.MenuId0, x.Text, x.Type)).ToListAsync(ct);

    public async Task SeedApiFunctionsAsync(CancellationToken ct = default)
    {
        var functions = new Dictionary<string, string>
        {
            ["ERP_ORG"] = "Đơn vị và nhà máy",
            ["ERP_MENU"] = "Menu hệ thống",
            ["ERP_NOTICE"] = "Thông báo",
            ["ERP_SETTINGS"] = "Tham số chung"
        };
        foreach (var (code, label) in FrontendPermissionCatalog.Functions)
            functions[code] = label;
        var functionIds = functions.Keys.ToArray();
        var existing = await db.SysCommand.Where(x => functionIds.Contains(x.MenuId0))
            .Select(x => x.MenuId0).ToListAsync(ct);
        foreach (var function in functions.Where(x => !existing.Contains(x.Key)))
            db.SysCommand.Add(new SysCommand { MenuId0 = function.Key, MenuId = function.Key,
                Text = function.Value, Type = "M" });
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken ct = default)
    {
        var roles = await db.SysRole.AsNoTracking().OrderBy(x => x.RoleName).ToListAsync(ct);
        var grants = await db.SysRoleCommand.AsNoTracking().Where(x => x.Status == "1").ToListAsync(ct);
        return roles.Select(role => new RoleDto(role.RoleId, role.RoleName, role.Description,
            role.ValidFlg == 1, grants.Where(x => x.RoleId == role.RoleId).Select(ToDto).ToList())).ToList();
    }

    public async Task<int> SaveRoleAsync(SaveRoleRequest request, CancellationToken ct = default)
    {
        if (request.RoleId < 0 || string.IsNullOrWhiteSpace(request.RoleName)
            || request.RoleName.Length > 100 || request.Permissions is null)
            throw new ArgumentException("Role request is invalid.");
        var roleName = request.RoleName.Trim();
        await ValidateGrantsAsync(request.Permissions, ct);
        if (await db.SysRole.AnyAsync(x => x.RoleName == roleName && x.RoleId != request.RoleId, ct))
            throw new ArgumentException("RoleName already exists.");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var role = request.RoleId == 0 ? new SysRole() : await db.SysRole.FindAsync([request.RoleId], ct)
            ?? throw new ArgumentException("Role does not exist.");
        role.RoleName = roleName;
        role.Description = request.Description;
        role.ValidFlg = request.IsActive ? (short)1 : (short)0;
        if (request.RoleId == 0) db.SysRole.Add(role);
        await db.SaveChangesAsync(ct);

        var old = await db.SysRoleCommand.Where(x => x.RoleId == role.RoleId).ToListAsync(ct);
        db.SysRoleCommand.RemoveRange(old);
        await db.SaveChangesAsync(ct);
        foreach (var grant in request.Permissions)
            db.SysRoleCommand.Add(ToRoleEntity(role.RoleId, grant));
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return role.RoleId;
    }

    public async Task SetUserRolesAsync(int userId, IReadOnlyCollection<int> roleIds, CancellationToken ct = default)
    {
        if (roleIds is null) throw new ArgumentException("RoleIds are required.");
        if (!await db.SysUser.AnyAsync(x => x.UserId == userId && x.ValidFlg == 1, ct))
            throw new ArgumentException("User does not exist.");
        var distinct = roleIds.Distinct().ToArray();
        if (await db.SysRole.CountAsync(x => distinct.Contains(x.RoleId) && x.ValidFlg == 1, ct) != distinct.Length)
            throw new ArgumentException("One or more roles are invalid.");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var old = await db.SysUserRole.Where(x => x.UserId == userId).ToListAsync(ct);
        db.SysUserRole.RemoveRange(old);
        await db.SaveChangesAsync(ct);
        db.SysUserRole.AddRange(distinct.Select(roleId => new SysUserRole { UserId = userId, RoleId = roleId }));
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task SetUserPermissionsAsync(int userId, IReadOnlyCollection<PermissionGrantDto> permissions, CancellationToken ct = default)
    {
        if (permissions is null) throw new ArgumentException("Permissions are required.");
        if (!await db.SysUser.AnyAsync(x => x.UserId == userId && x.ValidFlg == 1, ct))
            throw new ArgumentException("User does not exist.");
        await ValidateGrantsAsync(permissions, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var old = await db.SysUserCommand.Where(x => x.UserId == userId).ToListAsync(ct);
        db.SysUserCommand.RemoveRange(old);
        await db.SaveChangesAsync(ct);
        db.SysUserCommand.AddRange(permissions.Select(x => ToUserEntity(userId, x)));
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    private async Task ValidateGrantsAsync(IReadOnlyCollection<PermissionGrantDto> grants, CancellationToken ct)
    {
        var ids = grants.Select(x => x.MenuId0).ToArray();
        if (ids.Any(x => string.IsNullOrWhiteSpace(x) || x.Length > 64)
            || ids.Length != ids.Distinct(StringComparer.Ordinal).Count())
            throw new ArgumentException("Permission menu IDs must be unique and nonempty.");
        if (await db.SysCommand.CountAsync(x => ids.Contains(x.MenuId0), ct) != ids.Length)
            throw new ArgumentException("One or more permission menu IDs do not exist.");
    }

    private static PermissionGrantDto ToDto(SysRoleCommand x) => new()
    {
        MenuId0 = x.MenuId0, CanView = x.CanView, CanAdd = x.CanAdd, CanEdit = x.CanEdit,
        CanDelete = x.CanDelete, CanPrint = x.CanPrint, CanImport = x.CanImport,
        CanExport = x.CanExport, CanSearch = x.CanSearch, CanReload = x.CanReload,
        CanCopy = x.CanCopy, CanApprove = x.CanApprove
    };

    private static PermissionGrantDto ToDto(SysUserCommand x) => new()
    {
        MenuId0 = x.MenuId0, CanView = x.CanView, CanAdd = x.CanAdd, CanEdit = x.CanEdit,
        CanDelete = x.CanDelete, CanPrint = x.CanPrint, CanImport = x.CanImport,
        CanExport = x.CanExport, CanSearch = x.CanSearch, CanReload = x.CanReload,
        CanCopy = x.CanCopy, CanApprove = x.CanApprove
    };

    private static SysRoleCommand ToRoleEntity(int roleId, PermissionGrantDto x) => new()
    {
        RoleId = roleId, MenuId0 = x.MenuId0, CanView = x.CanView, CanAdd = x.CanAdd,
        CanEdit = x.CanEdit, CanDelete = x.CanDelete, CanPrint = x.CanPrint,
        CanImport = x.CanImport, CanExport = x.CanExport, CanSearch = x.CanSearch,
        CanReload = x.CanReload, CanCopy = x.CanCopy, CanApprove = x.CanApprove
    };

    private static SysUserCommand ToUserEntity(int userId, PermissionGrantDto x) => new()
    {
        UserId = userId, MenuId0 = x.MenuId0, CanView = x.CanView, CanAdd = x.CanAdd,
        CanEdit = x.CanEdit, CanDelete = x.CanDelete, CanPrint = x.CanPrint,
        CanImport = x.CanImport, CanExport = x.CanExport, CanSearch = x.CanSearch,
        CanReload = x.CanReload, CanCopy = x.CanCopy, CanApprove = x.CanApprove
    };
}
