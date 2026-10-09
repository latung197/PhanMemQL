using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Danh mục kho. The endpoints come from CatalogControllerBase; other screens pick warehouses with the
/// lookup (GET /api/lookups/warehouses).</summary>
[Route("api/inventory/warehouses")]
[CatalogFunction("inv_warehouse_cat")]
public sealed class WarehousesController(IWarehouseService warehouses, IPermissionService permissions)
    : CatalogControllerBase<WarehouseDto, SaveWarehouseRequest>(warehouses, permissions);
