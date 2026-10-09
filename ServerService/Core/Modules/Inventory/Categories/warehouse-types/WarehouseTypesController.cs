using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Danh mục loại kho. The endpoints come from CatalogControllerBase; other screens pick types with the
/// lookup (GET /api/lookups/warehouseTypes).</summary>
[Route("api/inventory/warehouse-types")]
[CatalogFunction("inv_warehouse_type_cat")]
public sealed class WarehouseTypesController(IWarehouseTypeService types, IPermissionService permissions)
    : CatalogControllerBase<WarehouseTypeDto, SaveWarehouseTypeRequest>(types, permissions);
