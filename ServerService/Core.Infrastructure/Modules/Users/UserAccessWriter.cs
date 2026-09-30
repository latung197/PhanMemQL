using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Users;

/// <summary>
/// Replaces a user's role, permission matrix and unit list. Shared by user management, role sync and
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

    /// <summary>Null or empty removes the user's own matrix, so the role matrix applies.</summary>
    public async Task ReplaceMatrixAsync(int userId, IReadOnlyDictionary<string, ActionPermissions>? matrix,
        CancellationToken ct)
    {
        var current = await db.UserCommands.Where(x => x.UserId == userId).ToListAsync(ct);
        matrix ??= new Dictionary<string, ActionPermissions>();
        db.UserCommands.RemoveRange(current.Where(x => !matrix.ContainsKey(x.MenuId0)));
        foreach (var (code, actions) in matrix)
        {
            var row = current.FirstOrDefault(x => x.MenuId0 == code);
            if (row is null) db.UserCommands.Add(row = new SysUserCommand { UserId = userId, MenuId0 = code });
            row.Status = "1";
            row.SetActions(actions);
        }
    }

    /// <summary>Replaces the user's own special rights ("{function}:{code}").</summary>
    public async Task ReplaceRightsAsync(int userId, IReadOnlyCollection<string>? rights, CancellationToken ct)
    {
        var wanted = (rights ?? []).Distinct(StringComparer.Ordinal).ToHashSet(StringComparer.Ordinal);
        var current = await db.UserRights.Where(x => x.UserId == userId).ToListAsync(ct);
        db.UserRights.RemoveRange(current.Where(x => !wanted.Contains($"{x.MenuId0}:{x.RightCode}")));
        foreach (var key in wanted.Where(k => current.All(x => $"{x.MenuId0}:{x.RightCode}" != k)))
        {
            var (function, code) = SpecialRightCatalog.Split(key);
            db.UserRights.Add(new SysUserRight { UserId = userId, MenuId0 = function, RightCode = code });
        }
    }

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
