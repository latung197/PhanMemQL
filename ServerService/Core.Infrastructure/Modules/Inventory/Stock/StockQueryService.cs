using Core.Application.Common.Exceptions;
using Core.Application.Common.Paging;
using Core.Application.Common.Persistence;
using Core.Application.Modules.Inventory.Stock;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence.Sql;

namespace Core.Infrastructure.Modules.Inventory.Stock;

/// <summary>Reads the balances and the ledger of the company unit of the request (SQL files in Sql/).</summary>
public sealed class StockQueryService(ISqlExecutor sql) : IStockQuery
{
    private const string Module = "Inventory.Stock";
    private const int MaxPageSize = PagingLimits.MaxPageSize;

    private sealed class BalanceRow
    {
        public string UnitCode { get; set; } = "";
        public string WarehouseCode { get; set; } = "";
        public string? WarehouseName { get; set; }
        public string MaterialCode { get; set; } = "";
        public string? MaterialName { get; set; }
        public string? UomCode { get; set; }
        public string LotCode { get; set; } = "";
        public string? LotNo { get; set; }
        public DateOnly? ExpDate { get; set; }
        public string LocationCode { get; set; } = "";
        public decimal Quantity { get; set; }
        public decimal? Value { get; set; }
        public long Total { get; set; }
    }

    private sealed class MovementRow
    {
        public long Id { get; set; }
        public string SourceFunction { get; set; } = "";
        public long SourceId { get; set; }
        public long SourceLineId { get; set; }
        public string UnitCode { get; set; } = "";
        public string WarehouseCode { get; set; } = "";
        public string MaterialCode { get; set; } = "";
        public string? MaterialName { get; set; }
        public string? LotCode { get; set; }
        public string? LocationCode { get; set; }
        public DateOnly DocumentDate { get; set; }
        public decimal Quantity { get; set; }
        public decimal Value { get; set; }
        public string UomCode { get; set; } = "";
        public string? LineUomCode { get; set; }
        public decimal? LineQuantity { get; set; }
        public int PostingSeq { get; set; }
        public long? ReversalOfId { get; set; }
        public DateTime CreatedAt { get; set; }
        public long Total { get; set; }
    }

    public async Task<PagedResult<StockBalanceDto>> GetBalancesAsync(string unitCode, StockBalanceQuery query, bool canSeeCost, CancellationToken ct)
    {
        var script = (query.Level ?? "warehouse").ToLowerInvariant() switch
        {
            "warehouse" => "BalancesWarehouse",
            "lot" => "BalancesLot",
            "location" => "BalancesLocation",
            _ => throw new BusinessRuleException("stock.levelInvalid")
        };
        var (page, size) = Page(query.Page, query.PageSize);
        var rows = await sql.QueryAsync<BalanceRow>(SqlScripts.Get(Module, script), new
        {
            unit = unitCode, warehouse = Code(query.WarehouseCode), material = Code(query.MaterialCode), lot = Code(query.LotCode),
            location = Code(query.LocationCode), includeZero = query.IncludeZero,
            search = string.IsNullOrWhiteSpace(query.Search) ? null : PagingExtensions.ContainsPattern(query.Search),
            pageSize = size, offset = (page - 1) * size
        }, ct);
        var items = rows.Select(x => new StockBalanceDto(x.UnitCode, x.WarehouseCode, x.WarehouseName, x.MaterialCode, x.MaterialName,
            x.UomCode, x.LotCode, x.LotNo, x.ExpDate, x.LocationCode, x.Quantity,
            canSeeCost ? x.Value : null)).ToList();
        return new PagedResult<StockBalanceDto>(items, (int)(rows.Count == 0 ? 0 : rows[0].Total), page, size);
    }

    public async Task<PagedResult<StockMovementDto>> GetMovementsAsync(string unitCode, StockMovementQuery query, bool canSeeCost, CancellationToken ct)
    {
        var (page, size) = Page(query.Page, query.PageSize);
        var rows = await sql.QueryAsync<MovementRow>(SqlScripts.Get(Module, "Movements"), new
        {
            unit = unitCode, warehouse = Code(query.WarehouseCode), material = Code(query.MaterialCode), lot = Code(query.LotCode),
            location = Code(query.LocationCode), from = query.From?.ToDateTime(TimeOnly.MinValue), to = query.To?.ToDateTime(TimeOnly.MinValue),
            function = string.IsNullOrWhiteSpace(query.SourceFunction) ? null : query.SourceFunction.Trim(), sourceId = query.SourceId,
            pageSize = size, offset = (page - 1) * size
        }, ct);
        var items = rows.Select(x => new StockMovementDto(x.Id, x.SourceFunction, x.SourceId, x.SourceLineId, x.UnitCode, x.WarehouseCode,
            x.MaterialCode, x.MaterialName, x.LotCode, x.LocationCode, x.DocumentDate, x.Quantity,
            canSeeCost ? x.Value : null, x.UomCode, x.LineUomCode, x.LineQuantity, x.PostingSeq, x.ReversalOfId, x.CreatedAt)).ToList();
        return new PagedResult<StockMovementDto>(items, (int)(rows.Count == 0 ? 0 : rows[0].Total), page, size);
    }

    private static (int Page, int Size) Page(int page, int size) => (Math.Max(1, page), Math.Clamp(size, 1, MaxPageSize));

    private static string? Code(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();

}
