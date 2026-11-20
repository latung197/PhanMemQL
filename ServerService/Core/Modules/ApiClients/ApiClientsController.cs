using Core.Application.Modules.ApiClients;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.ApiClients;

/// <summary>
/// Settings › Người dùng &amp; phân quyền › Khóa API (docs/he-thong/tich-hop-api-key.md): the machines that call the API with a key.
/// Super administrator only: a key is a way into the system, so who may make one is decided as strictly as who may edit the menu.
/// A key is returned only by Create and Rotate, never again.
/// </summary>
[Route("api/settings/api-clients"), Authorize(Policy = Policies.SuperAdmin)]
public sealed class ApiClientsController(IApiClientService clients) : ApiControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<ApiClientDto>> GetAll(CancellationToken ct) => clients.GetAllAsync(ct);

    [HttpPost]
    public Task<ApiClientKeyDto> Create(CreateApiClientRequest request, CancellationToken ct) =>
        clients.CreateAsync(CurrentUserId, request, ct);

    [HttpPut("{code}")]
    public Task<ApiClientDto> Update(string code, UpdateApiClientRequest request, CancellationToken ct) =>
        clients.UpdateAsync(CurrentUserId, code, request, ct);

    /// <summary>Replaces the key; the old one stops working at once.</summary>
    [HttpPost("{code}/rotate-key")]
    public Task<ApiClientKeyDto> RotateKey(string code, CancellationToken ct) => clients.RotateKeyAsync(CurrentUserId, code, ct);

    [HttpDelete("{code}")]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await clients.DeleteAsync(CurrentUserId, code, ct);
        return NoContent();
    }
}
