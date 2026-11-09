using Core.Application.Modules.Inventory;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory;

/// <summary>Kho › Định mức tồn kho. The endpoints come from CatalogControllerBase.</summary>
[Route("api/inventory/stock-norms")]
[CatalogFunction("inv_stock_norm_cat")]
public sealed class StockNormsController(IStockNormService norms, IPermissionService permissions)
    : CatalogControllerBase<StockNormDto, SaveStockNormRequest>(norms, permissions);
