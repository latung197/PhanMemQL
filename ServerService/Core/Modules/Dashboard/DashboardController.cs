using Core.Application.Modules.Dashboard;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Dashboard;

/// <summary>
/// The overview screen of the working unit. Open to every signed-in user: the service leaves out each part the user has no
/// View right for and the money the user may not see (VIEW_COST), so the screen needs no function of its own.
/// </summary>
[Route("api/dashboard")]
public sealed class DashboardController(IDashboardService dashboard) : ApiControllerBase
{
    /// <summary>?range=week|month|quarter|year (default month): the period of the voucher counters.</summary>
    [HttpGet]
    public Task<DashboardDto> Get([FromQuery] string? range, CancellationToken ct) =>
        dashboard.GetAsync(CurrentUserId, CurrentUnitCode, range, ct);
}
