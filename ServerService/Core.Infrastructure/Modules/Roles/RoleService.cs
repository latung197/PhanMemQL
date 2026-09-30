using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Common.Validation;
using Core.Application.Modules.Roles;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Approvals;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Modules.Users;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Roles;

public sealed class RoleService(CoreContext db, UserAccessWriter access, IPermissionService permissions,
    GrantGuard grants) : IRoleService
{
    public async Task<IReadOnlyList<RoleDto>> GetAllAsync(CancellationToken ct)
    {
        var roles = await db.Roles.AsNoTracking().Include(x => x.Permissions).Where(x => x.ValidFlg == 1)
            .OrderBy(x => x.RoleCode == SysRole.AdminCode ? 0 : 1).ThenBy(x => x.RoleName).ToListAsync(ct);
        var rights = await db.RoleRights.AsNoTracking().Where(x => x.Status == "1").ToListAsync(ct);
        return roles.Select(role => ToDto(role, rights.Where(x => x.RoleId == role.RoleId)
            .Select(x => SpecialRightCatalog.Key(x.MenuId0, x.RightCode)))).ToList();
    }

    public async Task<RoleDto> CreateAsync(int actorUserId, SaveRoleRequest request, CancellationToken ct)
    {
        if (string.Equals(request.Code?.Trim(), SysRole.AdminCode, StringComparison.OrdinalIgnoreCase))
            await permissions.EnsureAdminAsync(actorUserId, ct);
        await grants.EnsureCanGrantAsync(actorUserId, null, request.Permissions, null, request.SpecialRights, ct);
        var role = new SysRole();
        Apply(role, request);
        await EnsureUniqueAsync(role, ct);
        db.Roles.Add(role);
        await db.SaveChangesAsync(ct);
        var rights = await ReplaceRightsAsync(role, request.SpecialRights ?? [], ct);
        await db.SaveChangesAsync(ct);
        return ToDto(role, rights);
    }

    public async Task<RoleDto> UpdateAsync(int actorUserId, int roleId, SaveRoleRequest request, CancellationToken ct)
    {
        var role = await FindAsync(roleId, ct);
        if (role.IsAdmin || string.Equals(request.Code?.Trim(), SysRole.AdminCode, StringComparison.OrdinalIgnoreCase))
            await permissions.EnsureAdminAsync(actorUserId, ct);
        if (role.IsAdmin && !string.Equals(request.Code?.Trim(), SysRole.AdminCode, StringComparison.OrdinalIgnoreCase))
            throw new BusinessRuleException("Không thể đổi mã của vai trò quản trị hệ thống.");
        var before = role.Permissions.Where(x => x.Status == "1").ToDictionary(x => x.MenuId0, x => x.ToActions());
        await grants.EnsureCanGrantAsync(actorUserId, before, request.Permissions,
            await LoadRightsAsync(role.RoleId, ct), request.SpecialRights, ct);
        Apply(role, request);
        await EnsureUniqueAsync(role, ct);
        var rights = request.SpecialRights is null ? await LoadRightsAsync(role.RoleId, ct)
            : await ReplaceRightsAsync(role, request.SpecialRights, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(role, rights);
    }

    /// <summary>Copies the role matrix and special rights to every user holding the role.</summary>
    public async Task<int> SyncUsersAsync(int roleId, CancellationToken ct)
    {
        var role = await FindAsync(roleId, ct);
        var userIds = await db.UserRoles.Where(x => x.RoleId == roleId && x.Status == "1")
            .Select(x => x.UserId).ToListAsync(ct);
        var matrix = role.IsAdmin ? null
            : role.Permissions.Where(x => x.Status == "1").ToDictionary(x => x.MenuId0, x => x.ToActions());
        List<string> rights = role.IsAdmin ? [] : await LoadRightsAsync(roleId, ct);

        foreach (var userId in userIds)
        {
            await access.ReplaceMatrixAsync(userId, matrix, ct);
            await access.ReplaceRightsAsync(userId, rights, ct);
        }
        await db.SaveChangesAsync(ct);
        return userIds.Count;
    }

    public async Task DeleteAsync(int actorUserId, int roleId, CancellationToken ct)
    {
        var role = await FindAsync(roleId, ct);
        if (role.IsAdmin) throw new BusinessRuleException("Không thể xóa vai trò quản trị hệ thống.");

        // No foreign keys: check every table that links to the role by its id.
        var holders = await db.UserRoles.AsNoTracking()
            .Where(x => x.RoleId == roleId && db.Users.Any(u => u.UserId == x.UserId && u.ValidFlg == 1))
            .Select(x => x.UserId).Distinct().CountAsync(ct);
        if (holders > 0)
            throw new BusinessRuleException(
                $"Vai trò \"{role.RoleName}\" đang được gán cho {holders} người dùng. Hãy chuyển họ sang vai trò khác trước khi xóa.");
        var key = roleId.ToString();
        var rules = await db.ApprovalRules.AsNoTracking().CountAsync(x =>
            (x.ApproverType == ApproverTypes.Role && x.ApproverValue == key)
            || (x.RequesterType == RequesterTypes.Role && x.RequesterValue == key), ct);
        if (rules > 0)
            throw new BusinessRuleException(
                $"Vai trò \"{role.RoleName}\" đang được dùng trong {rules} quy tắc phê duyệt. Hãy sửa hoặc xóa các quy tắc đó trước.");

        // Hard delete: role_code / role_name are unique, so a soft-deleted row would block reusing them.
        db.RoleCommands.RemoveRange(await db.RoleCommands.Where(x => x.RoleId == roleId).ToListAsync(ct));
        db.RoleRights.RemoveRange(await db.RoleRights.Where(x => x.RoleId == roleId).ToListAsync(ct));
        db.UserRoles.RemoveRange(await db.UserRoles.Where(x => x.RoleId == roleId).ToListAsync(ct)); // deleted accounts only
        db.Roles.Remove(role);
        await db.SaveChangesAsync(ct);
    }

    private async Task<SysRole> FindAsync(int roleId, CancellationToken ct) =>
        await db.Roles.Include(x => x.Permissions).FirstOrDefaultAsync(x => x.RoleId == roleId && x.ValidFlg == 1, ct)
        ?? throw new NotFoundException("Vai trò không tồn tại.");

    private async Task EnsureUniqueAsync(SysRole role, CancellationToken ct)
    {
        if (await db.Roles.AnyAsync(x => x.RoleId != role.RoleId && (x.RoleCode == role.RoleCode || x.RoleName == role.RoleName), ct))
            throw new BusinessRuleException("Mã hoặc tên vai trò đã tồn tại.");
    }

    private static void Apply(SysRole role, SaveRoleRequest request)
    {
        role.RoleCode = Guard.Code(request.Code, 50, "Mã vai trò");
        role.RoleName = Guard.Required(request.Name, 100, "tên vai trò");
        role.Description = Guard.Optional(request.Description, 1000, "Mô tả");
        PermissionMatrix.EnsureKnownCodes(request.Permissions);
        PermissionMatrix.EnsureKnownRights(request.SpecialRights);

        // The administrator role always has full rights, so its matrix is not stored.
        var matrix = role.IsAdmin ? null : request.Permissions;
        if (matrix is null)
        {
            if (role.IsAdmin) role.Permissions.Clear();
            return;
        }
        role.Permissions.RemoveAll(x => !matrix.ContainsKey(x.MenuId0));
        foreach (var (functionCode, actions) in matrix)
        {
            var row = role.Permissions.FirstOrDefault(x => x.MenuId0 == functionCode);
            if (row is null) role.Permissions.Add(row = new SysRoleCommand { MenuId0 = functionCode });
            row.Status = "1";
            row.SetActions(actions);
        }
    }

    private async Task<List<string>> LoadRightsAsync(int roleId, CancellationToken ct) =>
        await db.RoleRights.AsNoTracking().Where(x => x.RoleId == roleId && x.Status == "1")
            .Select(x => x.MenuId0 + ":" + x.RightCode).ToListAsync(ct);

    /// <summary>The administrator role has every right implicitly, so nothing is stored for it.</summary>
    private async Task<List<string>> ReplaceRightsAsync(SysRole role, IReadOnlyCollection<string> rights, CancellationToken ct)
    {
        List<string> wanted = role.IsAdmin ? [] : rights.Distinct(StringComparer.Ordinal).ToList();
        var current = await db.RoleRights.Where(x => x.RoleId == role.RoleId).ToListAsync(ct);
        db.RoleRights.RemoveRange(current.Where(x => !wanted.Contains(SpecialRightCatalog.Key(x.MenuId0, x.RightCode))));
        foreach (var key in wanted.Where(k => current.All(x => SpecialRightCatalog.Key(x.MenuId0, x.RightCode) != k)))
        {
            var (function, code) = SpecialRightCatalog.Split(key);
            db.RoleRights.Add(new SysRoleRight { RoleId = role.RoleId, MenuId0 = function, RightCode = code });
        }
        return wanted;
    }

    private static RoleDto ToDto(SysRole role, IEnumerable<string> rights) => new(role.RoleId.ToString(), role.RoleCode,
        role.RoleName, role.Description ?? string.Empty, role.IsAdmin,
        role.IsAdmin ? PermissionMatrix.Uniform(ActionPermissions.Full)
            : PermissionMatrix.Build(role.Permissions.Where(x => x.Status == "1").Select(x => (x.MenuId0, x.ToActions()))),
        (role.IsAdmin ? SpecialRightCatalog.Keys : rights).OrderBy(x => x, StringComparer.Ordinal).ToList());
}
