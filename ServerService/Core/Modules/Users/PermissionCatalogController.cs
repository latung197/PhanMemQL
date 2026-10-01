using Core.Application.Common.Localization;
using Core.Application.Common.Permissions;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Users;

/// <summary>Special rights available per function, for the permission screen (any signed-in user).</summary>
[Route("api/settings/permission-catalog")]
public sealed class PermissionCatalogController : ApiControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        SpecialRights = SpecialRightCatalog.All.Select(x => new
        {
            x.Function, x.Code, Key = SpecialRightCatalog.Key(x.Function, x.Code), x.Name, x.Group, x.Description
        }),
        Groups = new Dictionary<string, string>
        {
            [SpecialRightGroups.Data] = Messages.T("rightGroup.data"),
            [SpecialRightGroups.Scope] = Messages.T("rightGroup.scope"),
            [SpecialRightGroups.Status] = Messages.T("rightGroup.status"),
            [SpecialRightGroups.Feature] = Messages.T("rightGroup.feature")
        }
    });
}
