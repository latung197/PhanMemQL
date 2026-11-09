using Core.Application.Common.Auditing;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Localization;
using Core.Application.Common.Persistence;
using Core.Application.Modules.Inventory.Reports;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Common.Persistence.Sql;
using Npgsql;

namespace Core.Infrastructure.Modules.Inventory.Reports;

/// <summary>
/// The stock reports of the company unit of the request. The queries are the database functions <c>rpt_*</c> of script
/// <c>55-inventory-reports.sql</c> (one thin SQL file each in Sql/); this class passes the filters, cuts the money out for a user without
/// VIEW_COST, applies the rules of <see cref="StockReportRules"/> and makes the Excel files.
/// </summary>
public sealed class StockReportService(ISqlExecutor sql, CoreContext db, IExcelExporter excel, IAuditLog audit) : IStockReports
{
    private const string Module = "Inventory.Reports";
    private const string ScriptName = "55-inventory-reports.sql";

    private sealed class BalanceRow
    {
        public string WarehouseCode { get; set; } = "";
        public string? WarehouseName { get; set; }
        public string MaterialCode { get; set; } = "";
        public string MaterialName { get; set; } = "";
        public string UomCode { get; set; } = "";
        public string? GroupCode { get; set; }
        public decimal Quantity { get; set; }
        public decimal Value { get; set; }
        public decimal? MinStock { get; set; }
        public decimal? MaxStock { get; set; }
    }

    private sealed class NxtRow
    {
        public string WarehouseCode { get; set; } = "";
        public string? WarehouseName { get; set; }
        public string MaterialCode { get; set; } = "";
        public string MaterialName { get; set; } = "";
        public string UomCode { get; set; } = "";
        public decimal OpeningQuantity { get; set; }
        public decimal InQuantity { get; set; }
        public decimal OutQuantity { get; set; }
        public decimal ClosingQuantity { get; set; }
        public decimal OpeningValue { get; set; }
        public decimal InValue { get; set; }
        public decimal OutValue { get; set; }
        public decimal ClosingValue { get; set; }
    }

    private sealed class MovementRow
    {
        public DateOnly DocumentDate { get; set; }
        public string SourceFunction { get; set; } = "";
        public string? VoucherCode { get; set; }
        public string? VoucherType { get; set; }
        public string? Partner { get; set; }
        public string WarehouseCode { get; set; } = "";
        public string? WarehouseName { get; set; }
        public string MaterialCode { get; set; } = "";
        public string MaterialName { get; set; } = "";
        public string UomCode { get; set; } = "";
        public string? LotCode { get; set; }
        public decimal Quantity { get; set; }
        public decimal Value { get; set; }
        public decimal UnitPrice { get; set; }
    }

    private sealed class SummaryRow
    {
        public string WarehouseCode { get; set; } = "";
        public string? WarehouseName { get; set; }
        public string MaterialCode { get; set; } = "";
        public string MaterialName { get; set; } = "";
        public string UomCode { get; set; } = "";
        public int VoucherCount { get; set; }
        public decimal Quantity { get; set; }
        public decimal Value { get; set; }
    }

    private sealed class AgingRow
    {
        public string WarehouseCode { get; set; } = "";
        public string? WarehouseName { get; set; }
        public string MaterialCode { get; set; } = "";
        public string MaterialName { get; set; } = "";
        public string UomCode { get; set; } = "";
        public decimal Quantity { get; set; }
        public decimal Qty030 { get; set; }
        public decimal Qty3160 { get; set; }
        public decimal Qty6190 { get; set; }
        public decimal Qty91180 { get; set; }
        public decimal QtyOver180 { get; set; }
        public decimal Value { get; set; }
        public decimal Value030 { get; set; }
        public decimal Value3160 { get; set; }
        public decimal Value6190 { get; set; }
        public decimal Value91180 { get; set; }
        public decimal ValueOver180 { get; set; }
    }

    private sealed class AvailabilityRow
    {
        public string WarehouseCode { get; set; } = "";
        public string? WarehouseName { get; set; }
        public string MaterialCode { get; set; } = "";
        public string MaterialName { get; set; } = "";
        public string UomCode { get; set; } = "";
        public string? GroupCode { get; set; }
        public decimal Quantity { get; set; }
        public decimal ReservedRequest { get; set; }
        public decimal ReservedOrder { get; set; }
        public decimal Available { get; set; }
    }

    private sealed class MonthlyCostRow
    {
        public string WarehouseCode { get; set; } = "";
        public string? WarehouseName { get; set; }
        public string MaterialCode { get; set; } = "";
        public string MaterialName { get; set; } = "";
        public string UomCode { get; set; } = "";
        public decimal OpeningQuantity { get; set; }
        public decimal OpeningValue { get; set; }
        public decimal InQuantity { get; set; }
        public decimal InValue { get; set; }
        public decimal OutQuantity { get; set; }
        public decimal OutValue { get; set; }
        public decimal ClosingQuantity { get; set; }
        public decimal ClosingValue { get; set; }
        public decimal? MonthAvgCost { get; set; }
        public decimal? ClosingCost { get; set; }
    }

    private static DateTime Day(DateOnly value) => value.ToDateTime(TimeOnly.MinValue);
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);
    private static string? Code(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();
    private static string? Pattern(string? value) => string.IsNullOrWhiteSpace(value) ? null : PagingExtensions.ContainsPattern(value);

    /// <summary>Runs one report query; a missing function means the script was not run, which deserves a clear message instead of a bare 500.</summary>
    private async Task<IReadOnlyList<T>> QueryAsync<T>(string script, object parameters, CancellationToken ct)
    {
        try { return await sql.QueryAsync<T>(SqlScripts.Get(Module, script), parameters, ct); }
        catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.UndefinedFunction)
        { throw new BusinessRuleException("report.functionMissing", ScriptName); }
    }

    private static IReadOnlyList<T> Limited<T>(IReadOnlyList<T> rows) =>
        rows.Count > StockReportRules.MaxRows ? throw new BusinessRuleException("report.tooMany", StockReportRules.MaxRows) : rows;

    // ------------------------------------------------------------------------------------------------ stock

    public async Task<IReadOnlyList<StockReportRowDto>> GetStockAsync(string unitCode, StockReportQuery query, bool canSeeCost, CancellationToken ct)
    {
        var rows = Limited(await QueryAsync<BalanceRow>("StockBalance", new
        {
            unit = unitCode, asof = Day(query.AsOf ?? Today), warehouse = Code(query.Warehouse), materialGroup = Code(query.Group),
            search = Pattern(query.Search), includeZero = query.IncludeZero
        }, ct));
        return rows.Select(x => new StockReportRowDto(x.WarehouseCode, x.WarehouseName, x.MaterialCode, x.MaterialName, x.UomCode, x.GroupCode,
            x.Quantity, canSeeCost ? x.Value : null, canSeeCost && x.Quantity > 0 ? StockReportRules.AverageCost(x.Quantity, x.Value) : null,
            x.MinStock, x.MaxStock, StockReportRules.Level(x.Quantity, x.MinStock, x.MaxStock))).ToList();
    }

    // ------------------------------------------------------------------------------------------------ in - out - stock

    public async Task<IReadOnlyList<NxtRowDto>> GetNxtAsync(string unitCode, NxtReportQuery query, bool canSeeCost, CancellationToken ct)
    {
        var (from, to) = StockReportRules.Period(query.From, query.To, Today);
        var rows = Limited(await QueryAsync<NxtRow>("StockNxt", new
        {
            unit = unitCode, from = Day(from), to = Day(to), warehouse = Code(query.Warehouse), materialGroup = Code(query.Group),
            search = Pattern(query.Search), includeZero = query.IncludeZero
        }, ct));
        return rows.Select(x => new NxtRowDto(x.WarehouseCode, x.WarehouseName, x.MaterialCode, x.MaterialName, x.UomCode,
            x.OpeningQuantity, x.InQuantity, x.OutQuantity, x.ClosingQuantity,
            canSeeCost ? x.OpeningValue : null, canSeeCost ? x.InValue : null, canSeeCost ? x.OutValue : null, canSeeCost ? x.ClosingValue : null)).ToList();
    }

    // ------------------------------------------------------------------------------------------------ goods in / out

    public async Task<MovementReportDto> GetMovementAsync(string unitCode, bool inward, MovementReportQuery query, bool canSeeCost, CancellationToken ct)
    {
        var summary = StockReportRules.IsSummary(query.Mode);
        var (from, to) = StockReportRules.Period(query.From, query.To, Today);
        var common = (unit: unitCode, direction: inward ? 1 : -1, from: Day(from), to: Day(to), warehouse: Code(query.Warehouse),
            materialGroup: Code(query.Group), search: Pattern(query.Search));
        if (summary)
        {
            var rows = Limited(await QueryAsync<SummaryRow>("StockMovementSummary", new
            {
                common.unit, common.direction, common.from, common.to, common.warehouse, common.materialGroup, common.search
            }, ct));
            return new MovementReportDto("summary", [], rows.Select(x => new MovementSummaryRowDto(x.WarehouseCode, x.WarehouseName, x.MaterialCode,
                x.MaterialName, x.UomCode, x.VoucherCount, x.Quantity, canSeeCost ? x.Value : null)).ToList());
        }
        // One row more than the limit tells whether the report is too long without reading all of it.
        var detail = Limited(await QueryAsync<MovementRow>("StockMovements", new
        {
            common.unit, common.direction, common.from, common.to, common.warehouse, common.materialGroup, common.search, limit = StockReportRules.MaxRows + 1
        }, ct));
        return new MovementReportDto("detail", detail.Select(x => new MovementDetailRowDto(x.DocumentDate, x.SourceFunction, x.VoucherCode, x.VoucherType, x.Partner,
            x.WarehouseCode, x.WarehouseName, x.MaterialCode, x.MaterialName, x.UomCode, x.LotCode, x.Quantity,
            canSeeCost ? x.Value : null, canSeeCost ? x.UnitPrice : null)).ToList(), []);
    }

    // ------------------------------------------------------------------------------------------------ aging

    public async Task<IReadOnlyList<AgingRowDto>> GetAgingAsync(string unitCode, AgingReportQuery query, bool canSeeCost, CancellationToken ct)
    {
        var rows = Limited(await QueryAsync<AgingRow>("StockAging", new
        {
            unit = unitCode, asof = Day(query.AsOf ?? Today), warehouse = Code(query.Warehouse), materialGroup = Code(query.Group), search = Pattern(query.Search)
        }, ct));
        return rows.Select(x => new AgingRowDto(x.WarehouseCode, x.WarehouseName, x.MaterialCode, x.MaterialName, x.UomCode, x.Quantity,
            x.Qty030, x.Qty3160, x.Qty6190, x.Qty91180, x.QtyOver180,
            canSeeCost ? x.Value : null, canSeeCost ? x.Value030 : null, canSeeCost ? x.Value3160 : null, canSeeCost ? x.Value6190 : null,
            canSeeCost ? x.Value91180 : null, canSeeCost ? x.ValueOver180 : null)).ToList();
    }

    // ------------------------------------------------------------------------------------------------ instant stock

    public async Task<IReadOnlyList<AvailabilityRowDto>> GetAvailabilityAsync(string unitCode, AvailabilityQuery query, CancellationToken ct)
    {
        var rows = Limited(await QueryAsync<AvailabilityRow>("StockAvailability", new
        {
            unit = unitCode, warehouse = Code(query.Warehouse), materialGroup = Code(query.Group), search = Pattern(query.Search), includeZero = query.IncludeZero
        }, ct));
        return rows.Select(x => new AvailabilityRowDto(x.WarehouseCode, x.WarehouseName, x.MaterialCode, x.MaterialName, x.UomCode, x.GroupCode,
            x.Quantity, x.ReservedRequest, x.ReservedOrder, x.Available)).ToList();
    }

    // ------------------------------------------------------------------------------------------------ monthly average cost

    public async Task<IReadOnlyList<MonthlyCostRowDto>> GetMonthlyCostAsync(string unitCode, MonthlyCostQuery query, bool canSeeCost, CancellationToken ct)
    {
        var (from, to) = StockReportRules.MonthPeriod(query.Year, query.Month, Today);
        var rows = Limited(await QueryAsync<MonthlyCostRow>("StockMonthlyCost", new
        {
            unit = unitCode, from = Day(from), to = Day(to), warehouse = Code(query.Warehouse), materialGroup = Code(query.Group),
            search = Pattern(query.Search), includeZero = query.IncludeZero
        }, ct));
        return rows.Select(x => new MonthlyCostRowDto(x.WarehouseCode, x.WarehouseName, x.MaterialCode, x.MaterialName, x.UomCode,
            x.OpeningQuantity, canSeeCost ? x.OpeningValue : null, x.InQuantity, canSeeCost ? x.InValue : null, x.OutQuantity, canSeeCost ? x.OutValue : null,
            x.ClosingQuantity, canSeeCost ? x.ClosingValue : null, canSeeCost ? x.MonthAvgCost : null, canSeeCost ? x.ClosingCost : null)).ToList();
    }

    // ------------------------------------------------------------------------------------------------ Excel

    private static string Header(string key) => $"export.report.{key}";

    private static string Source(string function) =>
        Messages.Find(Messages.CurrentLanguage, $"report.source.{function}") is not null ? Messages.T($"report.source.{function}") : function;

    private async Task<ExportFile> FileAsync<T>(int userId, string function, string sheetKey, string fileName, IReadOnlyList<ExportColumn<T>> columns,
        IReadOnlyList<T> rows, string filters, CancellationToken ct)
    {
        var content = excel.Write(sheetKey, columns, rows);
        // RecordAsync only adds the row to the context: it is written by this SaveChanges.
        await audit.RecordAsync(new AuditEntry(function, "stockReport", sheetKey, null, AuditActions.Export, [], $"{rows.Count} rows; {filters}"), ct);
        await db.SaveChangesAsync(ct);
        return new ExportFile(content, $"{fileName}_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    public async Task<ExportFile> ExportStockAsync(int userId, string unitCode, StockReportQuery query, bool canSeeCost, CancellationToken ct)
    {
        var rows = await GetStockAsync(unitCode, query, canSeeCost, ct);
        var columns = new List<ExportColumn<StockReportRowDto>>
        {
            new(Header("warehouse"), x => x.WarehouseName ?? x.WarehouseCode), new(Header("materialCode"), x => x.MaterialCode), new(Header("materialName"), x => x.MaterialName),
            new(Header("uom"), x => x.UomCode), new(Header("quantity"), x => x.Quantity)
        };
        if (canSeeCost) { columns.Add(new(Header("value"), x => x.Value)); columns.Add(new(Header("averageCost"), x => x.AverageCost)); }
        columns.Add(new(Header("minStock"), x => x.MinStock)); columns.Add(new(Header("maxStock"), x => x.MaxStock));
        columns.Add(new(Header("level"), x => Messages.T($"report.level.{x.Level}")));
        return await FileAsync(userId, "inv_report_stock", "export.report.sheet.stock", "TonKho", columns, rows,
            $"asOf={query.AsOf}; warehouse={query.Warehouse}; group={query.Group}; search={query.Search}", ct);
    }

    public async Task<ExportFile> ExportNxtAsync(int userId, string unitCode, NxtReportQuery query, bool canSeeCost, CancellationToken ct)
    {
        var rows = await GetNxtAsync(unitCode, query, canSeeCost, ct);
        var columns = new List<ExportColumn<NxtRowDto>>
        {
            new(Header("warehouse"), x => x.WarehouseName ?? x.WarehouseCode), new(Header("materialCode"), x => x.MaterialCode), new(Header("materialName"), x => x.MaterialName),
            new(Header("uom"), x => x.UomCode), new(Header("opening"), x => x.OpeningQuantity), new(Header("inQty"), x => x.InQuantity),
            new(Header("outQty"), x => x.OutQuantity), new(Header("closing"), x => x.ClosingQuantity)
        };
        if (canSeeCost)
        {
            columns.Add(new(Header("openingValue"), x => x.OpeningValue)); columns.Add(new(Header("inValue"), x => x.InValue));
            columns.Add(new(Header("outValue"), x => x.OutValue)); columns.Add(new(Header("closingValue"), x => x.ClosingValue));
        }
        return await FileAsync(userId, "inv_report_nxt", "export.report.sheet.nxt", "NhapXuatTon", columns, rows,
            $"from={query.From}; to={query.To}; warehouse={query.Warehouse}; group={query.Group}; search={query.Search}", ct);
    }

    public async Task<ExportFile> ExportAvailabilityAsync(int userId, string unitCode, AvailabilityQuery query, CancellationToken ct)
    {
        var rows = await GetAvailabilityAsync(unitCode, query, ct);
        var columns = new List<ExportColumn<AvailabilityRowDto>>
        {
            new(Header("warehouse"), x => x.WarehouseName ?? x.WarehouseCode), new(Header("materialCode"), x => x.MaterialCode), new(Header("materialName"), x => x.MaterialName),
            new(Header("uom"), x => x.UomCode), new(Header("onHand"), x => x.Quantity), new(Header("reservedRequest"), x => x.ReservedByRequests),
            new(Header("reservedOrder"), x => x.ReservedByOrders), new(Header("available"), x => x.Available)
        };
        return await FileAsync(userId, "inv_calc_instant_stock", "export.report.sheet.availability", "TonKhoTucThoi", columns, rows,
            $"warehouse={query.Warehouse}; group={query.Group}; search={query.Search}", ct);
    }

    public async Task<ExportFile> ExportMonthlyCostAsync(int userId, string unitCode, MonthlyCostQuery query, bool canSeeCost, CancellationToken ct)
    {
        var rows = await GetMonthlyCostAsync(unitCode, query, canSeeCost, ct);
        var columns = new List<ExportColumn<MonthlyCostRowDto>>
        {
            new(Header("warehouse"), x => x.WarehouseName ?? x.WarehouseCode), new(Header("materialCode"), x => x.MaterialCode), new(Header("materialName"), x => x.MaterialName),
            new(Header("uom"), x => x.UomCode), new(Header("opening"), x => x.OpeningQuantity), new(Header("inQty"), x => x.InQuantity),
            new(Header("outQty"), x => x.OutQuantity), new(Header("closing"), x => x.ClosingQuantity)
        };
        if (canSeeCost)
        {
            columns.Add(new(Header("openingValue"), x => x.OpeningValue)); columns.Add(new(Header("inValue"), x => x.InValue));
            columns.Add(new(Header("outValue"), x => x.OutValue)); columns.Add(new(Header("closingValue"), x => x.ClosingValue));
            columns.Add(new(Header("monthAvgCost"), x => x.MonthAverageCost)); columns.Add(new(Header("closingCost"), x => x.ClosingCost));
        }
        return await FileAsync(userId, "inv_calc_monthly_cost", "export.report.sheet.monthlyCost", "GiaTrungBinhThang", columns, rows,
            $"year={query.Year}; month={query.Month}; warehouse={query.Warehouse}; group={query.Group}; search={query.Search}", ct);
    }

    public async Task<ExportFile> ExportMovementAsync(int userId, string unitCode, bool inward, MovementReportQuery query, bool canSeeCost, CancellationToken ct)
    {
        var report = await GetMovementAsync(unitCode, inward, query, canSeeCost, ct);
        var function = inward ? "inv_report_inward" : "inv_report_outward";
        var sheet = inward ? "export.report.sheet.inward" : "export.report.sheet.outward";
        var name = inward ? "HangNhapKho" : "HangXuatKho";
        var filters = $"mode={report.Mode}; from={query.From}; to={query.To}; warehouse={query.Warehouse}; group={query.Group}; search={query.Search}";
        if (report.Mode == "summary")
        {
            var columns = new List<ExportColumn<MovementSummaryRowDto>>
            {
                new(Header("warehouse"), x => x.WarehouseName ?? x.WarehouseCode), new(Header("materialCode"), x => x.MaterialCode), new(Header("materialName"), x => x.MaterialName),
                new(Header("uom"), x => x.UomCode), new(Header("voucherCount"), x => x.VoucherCount), new(Header("quantity"), x => x.Quantity)
            };
            if (canSeeCost) columns.Add(new(Header("value"), x => x.Value));
            return await FileAsync(userId, function, sheet, name, columns, report.Summary, filters, ct);
        }
        var detail = new List<ExportColumn<MovementDetailRowDto>>
        {
            new(Header("date"), x => x.Date), new(Header("voucher"), x => x.VoucherCode), new(Header("source"), x => Source(x.SourceFunction)),
            new(Header("voucherType"), x => x.VoucherType), new(Header("partner"), x => x.Partner), new(Header("warehouse"), x => x.WarehouseName ?? x.WarehouseCode),
            new(Header("materialCode"), x => x.MaterialCode), new(Header("materialName"), x => x.MaterialName), new(Header("uom"), x => x.UomCode),
            new(Header("lot"), x => x.LotCode), new(Header("quantity"), x => x.Quantity)
        };
        if (canSeeCost) { detail.Add(new(Header("unitPrice"), x => x.UnitPrice)); detail.Add(new(Header("value"), x => x.Value)); }
        return await FileAsync(userId, function, sheet, name, detail, report.Detail, filters, ct);
    }

    public async Task<ExportFile> ExportAgingAsync(int userId, string unitCode, AgingReportQuery query, bool canSeeCost, CancellationToken ct)
    {
        var rows = await GetAgingAsync(unitCode, query, canSeeCost, ct);
        var columns = new List<ExportColumn<AgingRowDto>>
        {
            new(Header("warehouse"), x => x.WarehouseName ?? x.WarehouseCode), new(Header("materialCode"), x => x.MaterialCode), new(Header("materialName"), x => x.MaterialName),
            new(Header("uom"), x => x.UomCode), new(Header("quantity"), x => x.Quantity), new(Header("age0_30"), x => x.Qty0To30), new(Header("age31_60"), x => x.Qty31To60),
            new(Header("age61_90"), x => x.Qty61To90), new(Header("age91_180"), x => x.Qty91To180), new(Header("ageOver180"), x => x.QtyOver180)
        };
        if (canSeeCost)
        {
            columns.Add(new(Header("value"), x => x.Value)); columns.Add(new(Header("value0_30"), x => x.Value0To30)); columns.Add(new(Header("value31_60"), x => x.Value31To60));
            columns.Add(new(Header("value61_90"), x => x.Value61To90)); columns.Add(new(Header("value91_180"), x => x.Value91To180)); columns.Add(new(Header("valueOver180"), x => x.ValueOver180));
        }
        return await FileAsync(userId, "inv_report_aging", "export.report.sheet.aging", "TuoiHangTon", columns, rows,
            $"asOf={query.AsOf}; warehouse={query.Warehouse}; group={query.Group}; search={query.Search}", ct);
    }
}
