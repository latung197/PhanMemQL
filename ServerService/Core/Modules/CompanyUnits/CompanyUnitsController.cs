using Core.Application.Modules.CompanyUnits;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.CompanyUnits;

/// <summary>Settings › Đơn vị cơ sở. The endpoints come from CatalogControllerBase; the header unit picker and forms pick
/// units with the lookup (GET /api/lookups/companyUnits), the sign-in screen with GET /api/auth/company-units.</summary>
[Route("api/settings/company-units")]
[CatalogFunction("inv_company_unit_cat")]
public sealed class CompanyUnitsController(ICompanyUnitService units, IPermissionService permissions)
    : CatalogControllerBase<CompanyUnitDto, SaveCompanyUnitRequest>(units, permissions);
