using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Users;

/// <summary>
/// Replaces a user's role, permission exceptions and unit list. Shared by user management, role sync and
/// seeding. Existing rows are updated in place (no delete + insert of the same key). Changes are only
/// tracked; the caller saves inside its transaction.
/// </summary>
public sealed class UserAccessWriter(CoreContext db)
{
    public async Task ReplaceRoleAsync(int userId, SysRole? role, CancellationToken ct)
    {
        var current = await db.UserRoles.Where(x => x.UserId == userId).ToListAsync(ct);
        db.UserRoles.RemoveRange(current.Where(x => x.RoleId != role?.RoleId));
        if (role is null) return;
        if (current.FirstOrDefault(x => x.RoleId == role.RoleId) is { } kept) kept.Status = "1";
        else db.UserRoles.Add(new SysUserRole { UserId = userId, RoleId = role.RoleId });
    }

    /// <summary>
    /// Stores the user's exceptions to the role matrix (PermissionMatrix.Overrides). Null or empty removes
    /// them all, so the user has exactly the role rights.
    /// </summary>
    public async Task ReplaceMatrixOverridesAsync(int userId, IReadOnlyDictionary<string, ActionPermissions>? overrides,
        CancellationToken ct)
    {
        var current = await db.UserCommands.Where(x => x.UserId == userId).ToListAsync(ct);
        overrides ??= new Dictionary<string, ActionPermissions>();
        db.UserCommands.RemoveRange(current.Where(x => !overrides.ContainsKey(x.MenuId0)));
        foreach (var (code, actions) in overrides)
        {
            var row = current.FirstOrDefault(x => x.MenuId0 == code);
            if (row is null) db.UserCommands.Add(row = new SysUserCommand { UserId = userId, MenuId0 = code });
            row.Status = "1";
            row.SetActions(actions);
        }
    }

    /// <summary>
    /// Stores the user's special right exceptions ("{function}:{code}"): granted on top of the roles,
    /// denied although a role has them. Empty lists remove every exception.
    /// </summary>
    public async Task ReplaceRightOverridesAsync(int userId, IReadOnlyCollection<string> granted,
        IReadOnlyCollection<string> denied, CancellationToken ct)
    {
        var wanted = granted.Distinct(StringComparer.Ordinal).ToDictionary(k => k, _ => true, StringComparer.Ordinal);
        foreach (var key in denied) wanted.TryAdd(key, false);
        var current = await db.UserRights.Where(x => x.UserId == userId).ToListAsync(ct);
        db.UserRights.RemoveRange(current.Where(x => !wanted.ContainsKey(SpecialRightCatalog.Key(x.MenuId0, x.RightCode))));
        foreach (var (key, isGranted) in wanted)
        {
            var (function, code) = SpecialRightCatalog.Split(key);
            var row = current.FirstOrDefault(x => x.MenuId0 == function && x.RightCode == code);
            if (row is null) db.UserRights.Add(row = new SysUserRight { UserId = userId, MenuId0 = function, RightCode = code });
            row.Status = "1";
            row.IsGranted = isGranted;
        }
    }

    /// <summary>Removes every exception of the user, who then has exactly the rights of their roles.</summary>
    public async Task ClearOverridesAsync(int userId, CancellationToken ct)
    {
        await ReplaceMatrixOverridesAsync(userId, null, ct);
        await ReplaceRightOverridesAsync(userId, [], [], ct);
    }

    /// <summary>Combined matrix of a role (none for no role); the ADMIN role has everything.</summary>
    public async Task<Dictionary<string, ActionPermissions>> RoleMatrixAsync(SysRole? role, CancellationToken ct)
    {
        if (role is null) return PermissionMatrix.Uniform(ActionPermissions.None);
        if (role.IsAdmin) return PermissionMatrix.Uniform(ActionPermissions.Full);
        var rows = await db.RoleCommands.AsNoTracking().Where(x => x.RoleId == role.RoleId && x.Status == "1").ToListAsync(ct);
        return PermissionMatrix.Build(rows.Select(x => (x.MenuId0, x.ToActions())));
    }

    /// <summary>Special rights of a role as "{function}:{code}".</summary>
    public async Task<List<string>> RoleRightsAsync(SysRole? role, CancellationToken ct) =>
        role is null || role.IsAdmin ? [] : await db.RoleRights.AsNoTracking()
            .Where(x => x.RoleId == role.RoleId && x.Status == "1")
            .Select(x => x.MenuId0 + ":" + x.RightCode).ToListAsync(ct);

    public async Task ReplaceUnitsAsync(int userId, IReadOnlyCollection<string> unitCodes, CancellationToken ct)
    {
        var current = await db.UserCompanyUnits.Where(x => x.UserId == userId).ToListAsync(ct);
        db.UserCompanyUnits.RemoveRange(current.Where(x => !unitCodes.Contains(x.UnitCode)));
        db.UserCompanyUnits.AddRange(unitCodes.Where(code => current.All(x => x.UnitCode != code))
            .Select(code => new UserCompanyUnit { UserId = userId, UnitCode = code }));
    }

    /// <summary>
    /// Validates the default unit and the allowed list. The default unit is always included, first.
    /// </summary>
    public async Task<List<string>> ResolveUnitsAsync(string? defaultUnit, IEnumerable<string>? allowed,
        CancellationToken ct)
    {
        var main = defaultUnit?.Trim();
        if (string.IsNullOrEmpty(main)) throw new BusinessRuleException("Vui lòng chọn đơn vị cơ sở mặc định.");
        var codes = new[] { main }.Concat((allowed ?? []).Select(x => x.Trim()).Where(x => x.Length > 0))
            .Distinct(StringComparer.Ordinal).ToList();
        var active = await db.CompanyUnits.AsNoTracking()
            .Where(x => codes.Contains(x.Code) && x.IsActive).Select(x => x.Code).ToListAsync(ct);
        var missing = codes.FirstOrDefault(code => !active.Contains(code));
        if (missing is not null)
            throw new BusinessRuleException($"Đơn vị cơ sở {missing} không tồn tại hoặc đang tạm dừng.");
        return codes;
    }
}
