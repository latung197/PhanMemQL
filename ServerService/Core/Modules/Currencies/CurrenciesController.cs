using Core.Application.Modules.Currencies;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Currencies;

/// <summary>Settings › Ngoại tệ. The endpoints come from CatalogControllerBase; vouchers and screens pick a currency with the
/// lookup (GET /api/lookups/currencies).</summary>
[Route("api/settings/currencies")]
[CatalogFunction("sys_currencies")]
public sealed class CurrenciesController(ICurrencyService currencies, IPermissionService permissions)
    : CatalogControllerBase<CurrencyDto, SaveCurrencyRequest>(currencies, permissions);
