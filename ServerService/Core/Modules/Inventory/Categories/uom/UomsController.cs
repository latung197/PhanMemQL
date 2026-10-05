using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Danh mục đơn vị tính. The endpoints come from CatalogControllerBase; other screens pick units with the
/// lookup (GET /api/lookups/uoms: code, name, symbol).</summary>
[Route("api/inventory/uoms")]
[CatalogFunction("inv_uom_cat")]
public sealed class UomsController(IUomService uoms, IPermissionService permissions)
    : CatalogControllerBase<UomDto, SaveUomRequest>(uoms, permissions);
