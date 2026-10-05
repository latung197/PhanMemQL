using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Danh mục quy đổi đơn vị tính. The endpoints come from CatalogControllerBase.</summary>
[Route("api/inventory/uom-conversions")]
[CatalogFunction("inv_uom_conversion_cat")]
public sealed class UomConversionsController(IUomConversionService conversions, IPermissionService permissions)
    : CatalogControllerBase<UomConversionDto, SaveUomConversionRequest>(conversions, permissions);
