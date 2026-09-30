using Core.Application.Features.Erp.Settings;
using Core.Domain.Entity.Erp;
using Core.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Features.Erp.Settings;

public sealed class SettingService(CoreContext db) : ISettingService
{
    public async Task<IReadOnlyList<SettingDto>> GetEffectiveAsync(string unitCode, string? plantCode,
        bool includePrivate, CancellationToken ct)
    {
        var scopes = string.IsNullOrWhiteSpace(plantCode)
            ? new[] { "GLOBAL", $"U:{unitCode}" }
            : new[] { "GLOBAL", $"U:{unitCode}", $"P:{plantCode}" };
        var query = db.ErpSettings.AsNoTracking().Where(x => scopes.Contains(x.Scope));
        if (!includePrivate) query = query.Where(x => x.IsPublic);
        var settings = await query.ToListAsync(ct);
        return SettingResolver.Resolve(settings.Select(ToDto), unitCode, plantCode);
    }

    public async Task<IReadOnlyList<SettingDto>> GetAllAsync(CancellationToken ct) =>
        (await db.ErpSettings.AsNoTracking().OrderBy(x => x.Key).ThenBy(x => x.Scope)
            .ToListAsync(ct)).Select(ToDto).ToList();

    public async Task SaveAsync(int userId, SaveSettingRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Key) || request.Key.Length > 100
            || request.Value is null || request.Value.Length > 10000
            || string.IsNullOrWhiteSpace(request.Scope) || request.Scope.Length > 50)
            throw new ArgumentException("Tham số không hợp lệ.");
        var key = request.Key.Trim().ToUpperInvariant();
        var scope = request.Scope.Trim();
        if (scope.Equals("GLOBAL", StringComparison.OrdinalIgnoreCase)) scope = "GLOBAL";
        if (scope.StartsWith("U:", StringComparison.Ordinal))
        {
            var code = scope[2..];
            if (!await db.ErpUnits.AnyAsync(x => x.Code == code, ct))
                throw new ArgumentException("Đơn vị không tồn tại.");
        }
        else if (scope.StartsWith("P:", StringComparison.Ordinal))
        {
            var code = scope[2..];
            if (!await db.ErpPlants.AnyAsync(x => x.Code == code, ct))
                throw new ArgumentException("Nhà máy không tồn tại.");
        }
        else if (scope != "GLOBAL") throw new ArgumentException("Phạm vi tham số không hợp lệ.");

        var entity = await db.ErpSettings.FirstOrDefaultAsync(x => x.Key == key && x.Scope == scope, ct);
        if (entity is null) db.ErpSettings.Add(entity = new ErpSetting { Key = key, Scope = scope });
        entity.Value = request.Value;
        entity.IsPublic = request.IsPublic;
        entity.UpdatedAtUtc = DateTime.UtcNow;
        entity.UpdatedByUserId = userId;
        await db.SaveChangesAsync(ct);
    }

    private static SettingDto ToDto(ErpSetting x) => new(x.Key, x.Value, x.Scope, x.IsPublic);
}
