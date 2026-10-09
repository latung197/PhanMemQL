using Core.Application.Modules.Languages;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Languages;

/// <summary>Settings › Ngôn ngữ. The endpoints come from CatalogControllerBase; the active list for pickers is GET /api/auth/languages.</summary>
[Route("api/settings/languages")]
[CatalogFunction("sys_languages")]
public sealed class LanguagesController(ILanguageService languages, IPermissionService permissions)
    : CatalogControllerBase<LanguageDto, SaveLanguageRequest>(languages, permissions);
