using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Danh mục vị trí lưu kho. The endpoints come from CatalogControllerBase; other screens pick locations with
/// the lookup (GET /api/lookups/locations?warehouse=KHO1).</summary>
[Route("api/inventory/locations")]
[CatalogFunction("inv_location_cat")]
public sealed class StorageLocationsController(IStorageLocationService locations, IPermissionService permissions)
    : CatalogControllerBase<StorageLocationDto, SaveStorageLocationRequest>(locations, permissions);
