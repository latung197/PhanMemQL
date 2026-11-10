using Core.Application.Modules.{{PhanHe}}.Categories;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.{{PhanHe}}.Categories;

/// <summary>{{tenVi}} (lookup <c>{{tens}}</c>). The seven catalog endpoints and their rights come from CatalogControllerBase.</summary>
[Route("api/{{phanHe}}/{{kebab}}")]
[CatalogFunction("{{ma}}")]
public sealed class {{Tens}}Controller(I{{Ten}}Service service, IPermissionService permissions)
    : CatalogControllerBase<{{Ten}}Dto, Save{{Ten}}Request>(service, permissions);
