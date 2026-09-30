using System.Text.Json;
using Core.Application.Common.Exceptions;
using Core.Application.Modules.SystemConfig;
using Core.Application.Modules.Users;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.SystemConfig;

/// <summary>
/// Settings › defaults, fiscal year, currencies, exchange rates and company profile
/// (Frontend src/services/systemSettingsService.ts).
/// </summary>
[Route("api/settings/system-config")]
public sealed class SystemConfigController(ISystemConfigService config, IPermissionService permissions)
    : ApiControllerBase
{
    /// <summary>Effective sections for the current unit; missing sections use frontend defaults.</summary>
    [HttpGet]
    public Task<IReadOnlyDictionary<string, JsonElement>> Get(CancellationToken ct) =>
        config.GetEffectiveAsync(CurrentUnitCode, ct);

    /// <summary>Saves one section. Body = the section value. <paramref name="unitCode"/> saves a unit override.</summary>
    [HttpPut("{section}")]
    public async Task<IActionResult> Save(string section, [FromBody] JsonElement value,
        [FromQuery] string? unitCode, CancellationToken ct)
    {
        if (!SystemConfigSections.Functions.TryGetValue(section, out var function))
            throw new BusinessRuleException("Nhóm cài đặt không hợp lệ.");
        await permissions.EnsureAllowedAsync(CurrentUserId, function, PermissionAction.CreateEdit, ct);
        await config.SaveAsync(CurrentUserId, section, value, unitCode, ct);
        return NoContent();
    }
}
