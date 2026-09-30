namespace Core.Application.Features.Erp.Settings;

public sealed record SettingDto(string Key, string Value, string Scope, bool IsPublic);
public sealed record SaveSettingRequest(string Key, string Value, string Scope, bool IsPublic);

public interface ISettingService
{
    Task<IReadOnlyList<SettingDto>> GetEffectiveAsync(string unitCode, string? plantCode,
        bool includePrivate, CancellationToken ct);
    Task<IReadOnlyList<SettingDto>> GetAllAsync(CancellationToken ct);
    Task SaveAsync(int userId, SaveSettingRequest request, CancellationToken ct);
}
