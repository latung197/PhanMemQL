using Core.Application.Modules.Banners;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Banners;

/// <summary>Settings › Thanh thông báo hệ thống. The endpoints come from CatalogControllerBase; the strip under the header reads
/// the banners in force from <see cref="ActiveBannersController"/>.</summary>
[Route("api/settings/banners")]
[CatalogFunction("sys_banners")]
public sealed class BannersController(IBannerService banners, IPermissionService permissions)
    : CatalogControllerBase<BannerDto, SaveBannerRequest>(banners, permissions);

/// <summary>The banners in force for the signed-in user's company unit (open to every signed-in user, like the lookups).</summary>
[Route("api/banners")]
public sealed class ActiveBannersController(IBannerService banners) : ApiControllerBase
{
    [HttpGet("active")]
    public Task<IReadOnlyList<BannerActiveDto>> Active(CancellationToken ct) =>
        banners.GetActiveAsync(CurrentUnitCode, Request.Headers.AcceptLanguage.ToString().Split(',')[0], ct);
}
