using Core.Application.Modules.Currencies;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Currencies;

/// <summary>Settings › Tỷ giá (function sys_exchange_rates).</summary>
[Route("api/settings/exchange-rates")]
public sealed class ExchangeRatesController(IExchangeRateService rates) : ApiControllerBase
{
    private const string Function = "sys_exchange_rates";

    [HttpGet]
    public Task<IReadOnlyList<ExchangeRateDto>> GetAll([FromQuery] string? currency, CancellationToken ct) =>
        rates.GetAllAsync(currency, ct);

    /// <summary>Accounting rate to use for a voucher of that date (e.g. ?currency=USD&amp;date=2026-09-30).</summary>
    [HttpGet("rate")]
    public async Task<IActionResult> Rate([FromQuery] string currency, [FromQuery] DateOnly date, CancellationToken ct) =>
        Ok(new { currency, date, rate = await rates.GetRateAsync(currency, date, ct) });

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<ExchangeRateDto> Create(SaveExchangeRateRequest request, CancellationToken ct) =>
        rates.CreateAsync(CurrentUserId, request, ct);

    [HttpPut("{id:long}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<ExchangeRateDto> Update(long id, SaveExchangeRateRequest request, CancellationToken ct) =>
        rates.UpdateAsync(CurrentUserId, id, request, ct);

    [HttpDelete("{id:long}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await rates.DeleteAsync(id, ct);
        return NoContent();
    }
}
