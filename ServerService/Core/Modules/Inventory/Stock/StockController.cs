using Core.Application.Common.Paging;
using Core.Application.Common.Permissions;
using Core.Application.Modules.Inventory.Stock;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Inventory.Stock;

/// <summary>
/// Kho › tồn kho and sổ kho, read through the stock report (<c>inv_report_stock</c>; costs need its VIEW_COST right). Posting is
/// done by the vouchers themselves through IStockLedger, there is no endpoint for it.
/// </summary>
[Route("api/inventory/stock")]
public sealed class StockController(IStockQuery stock, IPermissionService permissions) : ApiControllerBase
{
    private const string Function = "inv_report_stock";

    /// <summary>Balances of the unit; <c>level</c> = warehouse (default, with value), lot or location.</summary>
    [HttpGet("balances"), RequirePermission(Function, PermissionAction.View)]
    public async Task<PagedResult<StockBalanceDto>> Balances([FromQuery] StockBalanceQuery query, CancellationToken ct) =>
        await stock.GetBalancesAsync(CurrentUnitCode, query, await CanSeeCostAsync(ct), ct);

    /// <summary>The ledger rows behind the balances, newest first.</summary>
    [HttpGet("movements"), RequirePermission(Function, PermissionAction.View)]
    public async Task<PagedResult<StockMovementDto>> Movements([FromQuery] StockMovementQuery query, CancellationToken ct) =>
        await stock.GetMovementsAsync(CurrentUnitCode, query, await CanSeeCostAsync(ct), ct);

    private Task<bool> CanSeeCostAsync(CancellationToken ct) => permissions.HasRightAsync(CurrentUserId, Function, SpecialRightCatalog.ViewCost, ct);
}

/// <summary>Kho › Tính tồn kho tức thời (<c>inv_calc_instant_stock</c>): checks the balance tables against the ledger and rebuilds them.</summary>
[Route("api/inventory/stock")]
public sealed class StockProcessController(IStockLedger ledger, IPermissionService permissions) : ApiControllerBase
{
    private const string Function = "inv_calc_instant_stock";

    /// <summary>Differences between the ledger and the balance tables of the unit (empty = all is well). The quantities are always shown;
    /// the values are stock costs, so they are 0 without the VIEW_COST right of the stock report (as its own balances).</summary>
    [HttpGet("verify"), RequirePermission(Function, PermissionAction.View)]
    public async Task<IReadOnlyList<StockDiscrepancy>> Verify(CancellationToken ct)
    {
        var found = await ledger.VerifyAsync(CurrentUnitCode, ct);
        if (await permissions.HasRightAsync(CurrentUserId, "inv_report_stock", SpecialRightCatalog.ViewCost, ct)) return found;
        return found.Select(x => x with { LedgerValue = 0, BalanceValue = 0 }).ToList();
    }

    /// <summary>Rebuilds the balance tables of the unit from the ledger; returns the number of balance rows written.</summary>
    [HttpPost("rebuild"), RequirePermission(Function, PermissionAction.Edit)]
    public async Task<object> Rebuild(CancellationToken ct) => new { rows = await ledger.RebuildAsync(CurrentUserId, CurrentUnitCode, ct) };
}
