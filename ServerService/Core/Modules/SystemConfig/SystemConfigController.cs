using System.Text.Json;
using Core.Application.Common.Exceptions;
using Core.Application.Modules.Auth;
using Core.Application.Modules.SystemConfig;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.SystemConfig;

/// <summary>
/// Settings kept as JSON sections: defaults, fiscal year, company profile and number format
/// (Frontend src/services/systemSettingsService.ts), plus backup / restore of all settings.
/// </summary>
[Route("api/settings/system-config")]
public sealed class SystemConfigController(ISystemConfigService config, IPermissionService permissions, IAuthService auth)
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
            throw new BusinessRuleException("settings.invalidSection");
        await permissions.EnsureAllowedAsync(CurrentUserId, function, PermissionAction.Edit, ct);
        if (!string.IsNullOrWhiteSpace(unitCode) && !await auth.HasUnitAccessAsync(CurrentUserId, unitCode, ct))
            throw new ForbiddenException("settings.unitNotAllowed");
        await config.SaveAsync(CurrentUserId, section, value, unitCode, ct);
        return NoContent();
    }

    /// <summary>All global settings as one file (Settings › Sao lưu & phục hồi). Administrators only.</summary>
    [HttpGet("backup"), Authorize(Policy = Policies.Admin)]
    public Task<SettingsBackup> Backup([FromServices] ISettingsBackupService backups, CancellationToken ct) =>
        backups.ExportAsync(ct);

    /// <summary>Restores a backup in one transaction (adds or updates, never deletes). Administrators only.</summary>
    [HttpPost("restore"), Authorize(Policy = Policies.Admin)]
    public async Task<IActionResult> Restore([FromServices] ISettingsBackupService backups, SettingsBackup backup,
        CancellationToken ct)
    {
        await backups.RestoreAsync(CurrentUserId, CurrentUnitCode, backup, ct);
        return NoContent();
    }
}
