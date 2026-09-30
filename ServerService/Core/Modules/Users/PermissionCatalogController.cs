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
            [SpecialRightGroups.Data] = "Dữ liệu được xem",
            [SpecialRightGroups.Scope] = "Phạm vi chứng từ",
            [SpecialRightGroups.Status] = "Trạng thái chứng từ",
            [SpecialRightGroups.Feature] = "Chức năng mở rộng"
        }
    });
}
