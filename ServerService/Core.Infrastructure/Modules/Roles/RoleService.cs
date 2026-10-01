using Core.Application.Common.Auditing;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Common.Persistence;
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
    GrantGuard grants, IUnitOfWork unitOfWork, IAuditLog auditLog, UserAccessAudit userAudit) : IRoleService
{
    /// <summary>Roles are managed on the Users &amp; permissions screen; their log entries belong to it.</summary>
    private const string AuditFunction = UserAccessAudit.Function;
    private const string AuditObject = "role";

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
        // The rights rows need the new role id, so the role is saved first; both saves share one transaction.
        var rights = await unitOfWork.ExecuteAsync(async token =>
        {
            db.Roles.Add(role);
            await db.SaveChangesAsync(token);
            var saved = await ReplaceRightsAsync(role, request.SpecialRights ?? [], token);
            // Code, name and description are logged automatically (SysRole is [Audited]); the rights are logged here.
            await RecordAsync(role, AuditActions.Permissions, new AuditDiff().Matrix(null, MatrixOf(role)).Rights(null, saved),
                null, token);
            await db.SaveChangesAsync(token);
            return saved;
        }, ct);
        return ToDto(role, rights);
    }

    public async Task<RoleDto> UpdateAsync(int actorUserId, int roleId, SaveRoleRequest request, CancellationToken ct)
    {
        var role = await FindAsync(roleId, ct);
        if (role.IsAdmin || string.Equals(request.Code?.Trim(), SysRole.AdminCode, StringComparison.OrdinalIgnoreCase))
            await permissions.EnsureAdminAsync(actorUserId, ct);
        if (role.IsAdmin && !string.Equals(request.Code?.Trim(), SysRole.AdminCode, StringComparison.OrdinalIgnoreCase))
            throw new BusinessRuleException("roles.adminCodeFixed");
        var before = role.Permissions.Where(x => x.Status == "1").ToDictionary(x => x.MenuId0, x => x.ToActions());
        var rightsBefore = await LoadRightsAsync(role.RoleId, ct);
        var matrixBefore = MatrixOf(role);
        await grants.EnsureCanGrantAsync(actorUserId, before, request.Permissions, rightsBefore, request.SpecialRights, ct);
        Apply(role, request);
        await EnsureUniqueAsync(role, ct);
        var rights = request.SpecialRights is null ? rightsBefore : await ReplaceRightsAsync(role, request.SpecialRights, ct);
        await RecordAsync(role, AuditActions.Permissions, new AuditDiff().Matrix(matrixBefore, MatrixOf(role))
            .Rights(rightsBefore, rights), null, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(role, rights);
    }

    /// <summary>
    /// Removes the permission exceptions of every user holding the role, so they have exactly the role
    /// rights. (Role changes reach holders without this; it only discards their individual adjustments.)
    /// </summary>
    public async Task<int> SyncUsersAsync(int actorUserId, int roleId, CancellationToken ct)
    {
        var role = await FindAsync(roleId, ct);
        var userIds = await db.UserRoles.Where(x => x.RoleId == roleId && x.Status == "1")
            .Select(x => x.UserId).ToListAsync(ct);
        // Dropping an exception can give back a right the administrator took away on purpose, so every holder
        // goes through the same check as editing their rights by hand.
        if (!await permissions.IsAdminAsync(actorUserId, ct))
            foreach (var userId in userIds)
            {
                if (await permissions.IsAdminAsync(userId, ct))
                    throw new ForbiddenException("roles.syncAdminOnly");
                var (matrixAfter, rightsAfter) = await RoleRightsOfAsync(userId, ct);
                await grants.EnsureCanGrantAsync(actorUserId, await permissions.GetEffectiveAsync(userId, ct), matrixAfter,
                    await permissions.GetRightsAsync(userId, ct), rightsAfter, ct);
            }
        var before = new Dictionary<int, UserAccessAudit.Snapshot>();
        foreach (var userId in userIds) before[userId] = await userAudit.SnapshotAsync(userId, ct);
        foreach (var userId in userIds) await access.ClearOverridesAsync(userId, ct);
        // Each holder's log shows the rights they gained or lost, so it is written after saving, in the same transaction.
        await unitOfWork.ExecuteAsync(async token =>
        {
            await db.SaveChangesAsync(token);
            var users = await db.Users.AsNoTracking().Where(x => userIds.Contains(x.UserId)).ToListAsync(token);
            foreach (var user in users)
                await userAudit.RecordAsync(user, before[user.UserId], await userAudit.SnapshotAsync(user.UserId, token),
                    AuditActions.Sync, role.RoleName, token);
            await RecordAsync(role, AuditActions.Sync, new AuditDiff(), userIds.Count.ToString(), token);
            await db.SaveChangesAsync(token);
        }, ct);
        return userIds.Count;
    }

    public async Task DeleteAsync(int actorUserId, int roleId, CancellationToken ct)
    {
        var role = await FindAsync(roleId, ct);
        if (role.IsAdmin) throw new BusinessRuleException("roles.deleteAdmin");

        // No foreign keys: check every table that links to the role by its id.
        var holders = await db.UserRoles.AsNoTracking()
            .Where(x => x.RoleId == roleId && db.Users.Any(u => u.UserId == x.UserId && u.ValidFlg == 1))
            .Select(x => x.UserId).Distinct().CountAsync(ct);
        if (holders > 0)
            throw new BusinessRuleException(
                "roles.hasHolders", role.RoleName, holders);
        var key = roleId.ToString();
        var rules = await db.ApprovalRules.AsNoTracking().CountAsync(x =>
            (x.ApproverType == ApproverTypes.Role && x.ApproverValue == key)
            || (x.RequesterType == RequesterTypes.Role && x.RequesterValue == key), ct);
        if (rules > 0)
            throw new BusinessRuleException(
                "roles.inApprovalRules", role.RoleName, rules);

        // Hard delete: role_code / role_name are unique, so a soft-deleted row would block reusing them.
        db.RoleCommands.RemoveRange(await db.RoleCommands.Where(x => x.RoleId == roleId).ToListAsync(ct));
        db.RoleRights.RemoveRange(await db.RoleRights.Where(x => x.RoleId == roleId).ToListAsync(ct));
        db.UserRoles.RemoveRange(await db.UserRoles.Where(x => x.RoleId == roleId).ToListAsync(ct)); // deleted accounts only
        db.Roles.Remove(role);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Rights of a user without any exception: the combined matrix and special rights of their roles, special
    /// rights only on functions they may view (same rule as PermissionService).
    /// </summary>
    private async Task<(Dictionary<string, ActionPermissions> Matrix, List<string> Rights)> RoleRightsOfAsync(int userId,
        CancellationToken ct)
    {
        var roleIds = db.UserRoles.ActiveRoles().Where(x => x.UserId == userId).Select(x => x.RoleId);
        var grantRows = await db.RoleCommands.AsNoTracking().Where(x => x.Status == "1" && roleIds.Contains(x.RoleId))
            .ToListAsync(ct);
        var matrix = PermissionMatrix.Build(grantRows.Select(x => (x.MenuId0, x.ToActions())));
        var rights = await db.RoleRights.AsNoTracking().Where(x => x.Status == "1" && roleIds.Contains(x.RoleId))
            .Select(x => x.MenuId0 + ":" + x.RightCode).ToListAsync(ct);
        return (matrix, PermissionMatrix.VisibleRights(rights, matrix));
    }

    private Task RecordAsync(SysRole role, string action, AuditDiff diff, string? note, CancellationToken ct) =>
        auditLog.RecordAsync(new AuditEntry(AuditFunction, AuditObject, role.RoleId.ToString(),
            $"{role.RoleName} [{role.RoleCode}]", action, diff.Changes, note), ct);

    /// <summary>The stored matrix; the administrator role has everything without stored rows.</summary>
    private static IReadOnlyDictionary<string, ActionPermissions> MatrixOf(SysRole role) => role.IsAdmin
        ? PermissionMatrix.Uniform(ActionPermissions.Full)
        : role.Permissions.Where(x => x.Status == "1").ToDictionary(x => x.MenuId0, x => x.ToActions());

    private async Task<SysRole> FindAsync(int roleId, CancellationToken ct) =>
        await db.Roles.Include(x => x.Permissions).FirstOrDefaultAsync(x => x.RoleId == roleId && x.ValidFlg == 1, ct)
        ?? throw new NotFoundException("roles.notFound");

    private async Task EnsureUniqueAsync(SysRole role, CancellationToken ct)
    {
        if (await db.Roles.AnyAsync(x => x.RoleId != role.RoleId && (x.RoleCode == role.RoleCode || x.RoleName == role.RoleName), ct))
            throw new BusinessRuleException("roles.codeOrNameTaken");
    }

    private static void Apply(SysRole role, SaveRoleRequest request)
    {
        role.RoleCode = Guard.Code(request.Code, 50, "field.roleCode");
        role.RoleName = Guard.Required(request.Name, 100, "field.roleName");
        role.Description = Guard.Optional(request.Description, 1000, "field.description");
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
