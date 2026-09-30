using System.Text.Json;
using Core.Application.Features.Erp.Settings;

namespace Core.Infrastructure.Features.Erp.Settings;

public sealed class FrontendSystemConfigService(ISettingService settings) : IFrontendSystemConfigService
{
    public async Task<IReadOnlyDictionary<string, JsonElement>> GetEffectiveAsync(string unitCode,
        CancellationToken ct)
    {
        var effective = await settings.GetEffectiveAsync(unitCode, null, false, ct);
        var result = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        foreach (var (section, key) in FrontendSystemConfig.Keys)
        {
            var setting = effective.FirstOrDefault(x => x.Key == key);
            if (setting is null) continue;
            using var document = JsonDocument.Parse(setting.Value);
            result[section] = document.RootElement.Clone();
        }
        return result;
    }

    public Task SaveAsync(int userId, string section, SaveFrontendConfigRequest request,
        CancellationToken ct)
    {
        FrontendSystemConfig.Validate(section, request.Value);
        if (request.Scope != "GLOBAL" && !request.Scope.StartsWith("U:", StringComparison.Ordinal))
            throw new ArgumentException("Cài đặt frontend chỉ hỗ trợ phạm vi toàn hệ thống hoặc đơn vị.");
        return settings.SaveAsync(userId, new SaveSettingRequest(
            FrontendSystemConfig.Keys[section], request.Value.GetRawText(), request.Scope, true), ct);
    }
}
