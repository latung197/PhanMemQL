using Core.Application.Common.Lookups;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Lookups;

/// <summary>
/// Lookups (ô chọn mã + F2) of the registered catalogs, for every signed-in user (vouchers and other catalogs pick
/// from them), e.g. GET /api/lookups/uoms?q=kg&amp;page=1&amp;pageSize=20, GET /api/lookups/uoms/codes?codes=KG,CAI.
/// </summary>
[Route("api/lookups/{name}")]
public sealed class LookupsController(ILookupService lookups) : ApiControllerBase
{
    [HttpGet]
    public Task<LookupPage> Search(string name, [FromQuery] LookupQuery query, CancellationToken ct) =>
        lookups.SearchAsync(name, query, ct);

    [HttpGet("codes")]
    public Task<IReadOnlyList<LookupItem>> Get(string name, [FromQuery] string? codes, CancellationToken ct) =>
        lookups.GetAsync(name, (codes ?? string.Empty).Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries), ct);
}
