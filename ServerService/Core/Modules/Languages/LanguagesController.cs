using Core.Application.Modules.Languages;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Languages;

/// <summary>Settings › Ngôn ngữ (function sys_languages). The active list for pickers is GET /api/auth/languages.</summary>
[Route("api/settings/languages")]
public sealed class LanguagesController(ILanguageService languages) : ApiControllerBase
{
    private const string Function = "sys_languages";

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<LanguageDto>> GetAll(CancellationToken ct) => languages.GetAllAsync(ct);

    [HttpPost, RequirePermission(Function, PermissionAction.CreateEdit)]
    public Task<LanguageDto> Create(SaveLanguageRequest request, CancellationToken ct) => languages.CreateAsync(request, ct);

    [HttpPut("{code}"), RequirePermission(Function, PermissionAction.CreateEdit)]
    public Task<LanguageDto> Update(string code, SaveLanguageRequest request, CancellationToken ct) =>
        languages.UpdateAsync(code, request, ct);

    [HttpDelete("{code}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await languages.DeleteAsync(code, ct);
        return NoContent();
    }
}
