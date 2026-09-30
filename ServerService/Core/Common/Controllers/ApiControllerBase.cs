using Core.Common.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Common.Controllers;

/// <summary>
/// Base for module controllers: requires a signed-in user with access to the token's company unit.
/// Service errors (AppException) are turned into HTTP responses by AppExceptionFilter.
/// </summary>
[ApiController]
[Authorize(Policy = Policies.UnitAccess)]
public abstract class ApiControllerBase : ControllerBase
{
    protected int CurrentUserId => User.GetUserId();
    protected string CurrentUnitCode => User.GetUnitCode();
}
