using Core.Application.Features.Erp.Menu;
using Core.Application.Security;
using Core.Domain.Entity.SystemEntities;
using Core.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Features.Erp.Menu;

public sealed class MenuService(CoreContext db, IAccessControlService access) : IMenuService
{
    public async Task<IReadOnlyList<MenuNodeDto>> GetMyMenuAsync(int userId, string unitCode, CancellationToken ct)
    {
        var all = await db.SysCommand.AsNoTracking().ToListAsync(ct);
        var permissions = await access.GetUserAccessAsync(userId, ct);
        var allowed = new HashSet<string>(StringComparer.Ordinal);
        var byCode = all.Where(x => x.IsVisible() && x.IsAllowedForDvcs(unitCode))
            .ToDictionary(x => x.MenuId0, StringComparer.Ordinal);
        var granted = permissions.EffectivePermissions.Where(x => "RCUDPIESLYA".Any(action => x.Has(action.ToString())))
            .Select(x => x.MenuId0).ToHashSet(StringComparer.Ordinal);
        foreach (var command in byCode.Values)
        {
            if (!permissions.IsAdmin && !granted.Contains(command.MenuId0)) continue;
            var current = command;
            var seen = new HashSet<string>(StringComparer.Ordinal);
            while (seen.Add(current.MenuId0) && allowed.Add(current.MenuId0))
            {
                if (!byCode.TryGetValue(current.MenuId, out var parent) || parent.MenuId0 == current.MenuId0)
                    break;
                current = parent;
            }
        }
        return MenuTreeBuilder.Build(byCode.Values.Where(x => allowed.Contains(x.MenuId0)).Select(ToDto));
    }

    public async Task<IReadOnlyList<MenuNodeDto>> GetAllAsync(CancellationToken ct) =>
        MenuTreeBuilder.Build((await db.SysCommand.AsNoTracking().ToListAsync(ct)).Select(ToDto));

    public async Task SaveAsync(SaveMenuRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || request.Code.Length > 64
            || string.IsNullOrWhiteSpace(request.Text) || request.Text.Length > 100
            || request.ParentCode?.Length > 64 || request.Route?.Length > 100
            || request.Icon?.Length > 200 || request.AllowedUnits?.Length > 1000)
            throw new ArgumentException("Thông tin menu không hợp lệ.");
        var parentCode = string.IsNullOrWhiteSpace(request.ParentCode) ? request.Code : request.ParentCode;
        if (parentCode != request.Code)
        {
            var all = await db.SysCommand.AsNoTracking().ToDictionaryAsync(x => x.MenuId0, ct);
            if (!all.ContainsKey(parentCode!)) throw new ArgumentException("Menu cha không tồn tại.");
            var seen = new HashSet<string>(StringComparer.Ordinal);
            var current = parentCode!;
            while (all.TryGetValue(current, out var parent) && seen.Add(current))
            {
                if (current == request.Code) throw new ArgumentException("Menu cha tạo thành vòng lặp.");
                if (parent.MenuId == current) break;
                current = parent.MenuId;
            }
        }
        var entity = await db.SysCommand.FindAsync([request.Code], ct);
        if (entity is null) db.SysCommand.Add(entity = new SysCommand { MenuId0 = request.Code });
        entity.MenuId = parentCode!;
        entity.Text = request.Text.Trim();
        entity.Command = request.Route?.Trim() ?? string.Empty;
        entity.Picture1 = request.Icon?.Trim() ?? string.Empty;
        entity.BasicRight = checked((short)Math.Clamp(request.SortOrder, short.MinValue, short.MaxValue));
        entity.HideYn = request.IsVisible ? (short)0 : (short)1;
        entity.DsDvcs = string.Join(',', (request.AllowedUnits ?? string.Empty).Split(',',
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        entity.Type = string.IsNullOrEmpty(entity.Command) ? "G" : "M";
        await db.SaveChangesAsync(ct);
    }

    private static MenuNodeDto ToDto(SysCommand x) => new()
    {
        Code = x.MenuId0, ParentCode = x.MenuId == x.MenuId0 ? null : x.MenuId,
        Text = x.Text, Route = string.IsNullOrWhiteSpace(x.Command) ? null : x.Command,
        Icon = string.IsNullOrWhiteSpace(x.Picture1) ? null : x.Picture1,
        SortOrder = x.BasicRight, IsVisible = x.IsVisible()
    };
}
