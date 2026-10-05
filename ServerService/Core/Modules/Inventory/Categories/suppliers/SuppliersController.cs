using Core.Application.Modules.Inventory.Categories.suppliers;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;


namespace Core.Modules.Inventory.Categories.suppliers
{
    /// <summary>Kho › Danh mục nhà cung cấp. The endpoints come from CatalogControllerBase; other screens pick suppliers with the
    /// lookup (GET /api/lookups/suppliers).</summary>
    [Route("api/inventory/suppliers")]
    [CatalogFunction("inv_supplier_cat")]
    public sealed class SuppliersController(ISupplierService suppliers, IPermissionService permissions)
        : CatalogControllerBase<SupplierDto, SaveSupplierRequest>(suppliers, permissions);

}
