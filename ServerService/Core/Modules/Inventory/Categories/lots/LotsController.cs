using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Lô và hạn sử dụng. The endpoints come from CatalogControllerBase; other screens pick lots with the lookup
/// (GET /api/lookups/lots?material=VT001).</summary>
[Route("api/inventory/lots")]
[CatalogFunction("inv_lot_cat")]
public sealed class LotsController(ILotService lots, IPermissionService permissions)
    : CatalogControllerBase<LotDto, SaveLotRequest>(lots, permissions);
