using Core.Application.Modules.TaxRates;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.TaxRates;

/// <summary>Settings › Mã thuế. The endpoints come from CatalogControllerBase; other screens pick a tax with the lookup
/// (GET /api/lookups/taxRates).</summary>
[Route("api/settings/tax-rates")]
[CatalogFunction("sys_tax_rates")]
public sealed class TaxRatesController(ITaxRateService taxRates, IPermissionService permissions)
    : CatalogControllerBase<TaxRateDto, SaveTaxRateRequest>(taxRates, permissions);
