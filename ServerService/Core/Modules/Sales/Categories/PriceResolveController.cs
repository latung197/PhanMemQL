using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Modules.Sales.Categories;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Sales.Categories;

/// <summary>
/// The price of a material for a customer: <c>?customer=KH001&amp;material=VT001&amp;uom=CAI&amp;currency=VND&amp;date=2026-10-20&amp;quantity=10</c>.
/// Apart from the price list catalog because its real user is the sales order screen: whoever may see the price lists, or whoever
/// writes a sales order and may see its prices (<c>sales_orders:VIEW_PRICE</c>), gets the price; nobody else does (a price is a price).
/// </summary>
[Route("api/sales/price-lists/resolve")]
public sealed class PriceResolveController(IPriceListService priceLists, IPermissionService permissions) : ApiControllerBase
{
    private const string Catalog = "sales_price_list_cat";
    private const string SalesOrders = "sales_orders";

    [HttpGet]
    public async Task<ActionResult<ResolvedPriceDto?>> Resolve([FromQuery] string? customer, [FromQuery] string material, [FromQuery] string uom,
        [FromQuery] string currency, [FromQuery] DateOnly? date, [FromQuery] decimal quantity, CancellationToken ct)
    {
        var matrix = await permissions.GetEffectiveAsync(CurrentUserId, ct);
        var mayReadCatalog = matrix.TryGetValue(Catalog, out var catalog) && catalog.View;
        var mayWriteOrders = matrix.TryGetValue(SalesOrders, out var orders) && (orders.Create || orders.Edit)
            && await permissions.HasRightAsync(CurrentUserId, SalesOrders, SpecialRightCatalog.ViewPrice, ct);
        if (!mayReadCatalog && !mayWriteOrders) throw new ForbiddenException("permission.denied");
        return Ok(await priceLists.ResolveAsync(customer, material, uom, currency, date, quantity <= 0 ? 1 : quantity, ct));
    }
}
