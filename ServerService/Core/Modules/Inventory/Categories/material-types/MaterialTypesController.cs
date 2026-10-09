using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Danh mục loại vật tư. The endpoints come from CatalogControllerBase; other screens pick types with the
/// lookup (GET /api/lookups/materialTypes).</summary>
[Route("api/inventory/material-types")]
[CatalogFunction("inv_material_type_cat")]
public sealed class MaterialTypesController(IMaterialTypeService types, IPermissionService permissions)
    : CatalogControllerBase<MaterialTypeDto, SaveMaterialTypeRequest>(types, permissions);
