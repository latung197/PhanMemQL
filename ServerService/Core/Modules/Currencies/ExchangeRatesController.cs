using Core.Application.Modules.Currencies;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Currencies;

/// <summary>Settings › Tỷ giá. The endpoints come from CatalogControllerBase; the rate for a voucher is
/// <see cref="ExchangeRateLookupController"/>.</summary>
[Route("api/settings/exchange-rates")]
[CatalogFunction("sys_exchange_rates")]
public sealed class ExchangeRatesController(IExchangeRateService rates, IPermissionService permissions)
    : CatalogControllerBase<ExchangeRateDto, SaveExchangeRateRequest>(rates, permissions);

/// <summary>The accounting rate to use for a voucher of a date, open to every signed-in user who writes vouchers
/// (e.g. <c>?currency=USD&amp;date=2026-09-30</c>). Not part of the catalog endpoints: those need the View right.</summary>
[Route("api/settings/exchange-rates/rate")]
public sealed class ExchangeRateLookupController(IExchangeRateService rates) : ApiControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Rate([FromQuery] string currency, [FromQuery] DateOnly date, CancellationToken ct) =>
        Ok(new { currency, date, rate = await rates.GetRateAsync(currency, date, ct) });
}
