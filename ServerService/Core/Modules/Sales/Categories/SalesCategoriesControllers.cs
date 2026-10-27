using Core.Application.Modules.Sales.Categories;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Sales.Categories;

/// <summary>Bán hàng › Danh mục nhóm khách hàng (lookup <c>customerGroups</c>).</summary>
[Route("api/sales/customer-groups")]
[CatalogFunction("sales_customer_group_cat")]
public sealed class CustomerGroupsController(ICustomerGroupService groups, IPermissionService permissions)
    : CatalogControllerBase<CustomerGroupDto, SaveCustomerGroupRequest>(groups, permissions);

/// <summary>Bán hàng › Danh mục khách hàng (lookup <c>customers</c>).</summary>
[Route("api/sales/customers")]
[CatalogFunction("sales_customers")]
public sealed class CustomersController(ICustomerService customers, IPermissionService permissions)
    : CatalogControllerBase<CustomerDto, SaveCustomerRequest>(customers, permissions);

/// <summary>Bán hàng › Danh mục bảng giá bán (lookup <c>priceLists</c>).</summary>
[Route("api/sales/price-lists")]
[CatalogFunction("sales_price_list_cat")]
public sealed class PriceListsController(IPriceListService priceLists, IPermissionService permissions)
    : CatalogControllerBase<PriceListDto, SavePriceListRequest>(priceLists, permissions)
{
    /// <summary>The lines (prices) of one price list: the form of the price list reads them when it opens.</summary>
    [HttpGet("{code}/lines"), CatalogRight(PermissionAction.View)]
    public Task<IReadOnlyList<PriceListLineDto>> Lines(string code, CancellationToken ct) => priceLists.GetLinesAsync(code, ct);

    /// <summary>The price of a material for a customer: ?customer=KH001&amp;material=VT001&amp;uom=CAI&amp;currency=VND&amp;date=2026-10-20&amp;quantity=10 (needs the price list View right).</summary>
    [HttpGet("resolve"), CatalogRight(PermissionAction.View)]
    public async Task<ActionResult<ResolvedPriceDto?>> Resolve([FromQuery] string? customer, [FromQuery] string material, [FromQuery] string uom,
        [FromQuery] string currency, [FromQuery] DateOnly? date, [FromQuery] decimal quantity, CancellationToken ct) =>
        Ok(await priceLists.ResolveAsync(customer, material, uom, currency, date, quantity <= 0 ? 1 : quantity, ct));
}
