using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Danh mục nhóm vật tư. The endpoints come from CatalogControllerBase; other screens pick groups with the
/// lookup (GET /api/lookups/materialGroups).</summary>
[Route("api/inventory/material-groups")]
[CatalogFunction("inv_material_group_cat")]
public sealed class MaterialGroupsController(IMaterialGroupService groups, IPermissionService permissions)
    : CatalogControllerBase<MaterialGroupDto, SaveMaterialGroupRequest>(groups, permissions);
