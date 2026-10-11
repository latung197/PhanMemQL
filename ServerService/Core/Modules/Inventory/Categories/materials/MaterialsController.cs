using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Danh mục vật tư. The endpoints come from CatalogControllerBase; other screens pick materials with the
/// lookup (GET /api/lookups/materials).</summary>
[Route("api/inventory/materials")]
[CatalogFunction("inv_material_cat")]
public sealed class MaterialsController(IMaterialService materials, IPermissionService permissions)
    : CatalogControllerBase<MaterialDto, SaveMaterialRequest>(materials, permissions);
