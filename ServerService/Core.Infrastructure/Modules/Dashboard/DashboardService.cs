using Core.Application.Common.Permissions;
using Core.Application.Common.Persistence;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Dashboard;
using Core.Application.Modules.Purchasing.Reports;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence.Sql;

namespace Core.Infrastructure.Modules.Dashboard;

/// <summary>
/// The dashboard of the working unit, built only from the vouchers, the stock ledger, the projects and the change log (SQL files in Sql/).
/// Every part is cut by the rights of the user: no View right, no part; no VIEW_COST right, no money.
/// </summary>
public sealed class DashboardService(ISqlExecutor sql, IPermissionService permissions, IDocumentApprovalService approvals, IProjectCostReport projectCost)
    : IDashboardService
{
    private const string Module = "Dashboard";
    private const string StockFunction = "inv_report_stock", ProjectFunction = "pur_report_project", AuditFunction = "sys_audit_log";
    private const int TopRows = 10, TopProjects = 5, TopApprovals = 5, TrendMonths = 6;

    /// <summary>The voucher functions and their tables (a fixed list, so the table name is never user input).</summary>
    private static readonly (string Function, string Table)[] Vouchers =
    [
        ("pur_request", "erp_purchase_request"), ("pur_order", "erp_purchase_order"),
        ("inv_receipt", "erp_goods_receipt"), ("inv_issue_request", "erp_issue_request"), ("inv_issue", "erp_goods_issue"),
        ("inv_transfer_order", "erp_transfer_order"), ("inv_transfer_issue", "erp_transfer_issue"), ("inv_transfer_receipt", "erp_transfer_receipt")
    ];

    private sealed class StatusRow { public string Status { get; set; } = ""; public int N { get; set; } }
    private sealed class WarehouseRow { public string Code { get; set; } = ""; public string Name { get; set; } = ""; public int ItemCount { get; set; } public decimal Value { get; set; } }
    private sealed class LowStockRow
    {
        public string MaterialCode { get; set; } = ""; public string MaterialName { get; set; } = ""; public string UomCode { get; set; } = "";
        public decimal Quantity { get; set; } public decimal MinStock { get; set; } public int TotalCount { get; set; }
    }
    private sealed class TrendRow { public string Month { get; set; } = ""; public string Kind { get; set; } = ""; public int N { get; set; } public decimal Value { get; set; } }
    private sealed class ActivityRow { public DateTime Time { get; set; } public string? ActorName { get; set; } public string Function { get; set; } = ""; public string Action { get; set; } = ""; public string? Label { get; set; } }

    public async Task<DashboardDto> GetAsync(int userId, string unitCode, string? range, CancellationToken ct)
    {
        var key = DashboardRanges.All.Contains(range ?? "") ? range! : DashboardRanges.Month;
        var today = DateOnly.FromDateTime(DateTime.Now);
        var from = DashboardRanges.From(key, today);
        var rights = await permissions.GetEffectiveAsync(userId, ct);
        bool CanView(string function) => rights.TryGetValue(function, out var p) && p.View;

        var visible = Vouchers.Where(v => CanView(v.Function)).ToList();
        var counts = new List<DashboardVoucherCountDto>();
        var drafts = 0;
        foreach (var (function, table) in visible)
        {
            var rows = await sql.QueryAsync<StatusRow>(
                $"SELECT status, count(*)::int AS n FROM {table} WHERE unit_code = @unit AND document_date >= @from::date AND document_date <= @to::date GROUP BY status",
                new { unit = unitCode, from = from.ToDateTime(TimeOnly.MinValue), to = today.ToDateTime(TimeOnly.MinValue) }, ct);
            int N(string status) => rows.Where(r => r.Status == status).Sum(r => r.N);
            counts.Add(new DashboardVoucherCountDto(function, N("Draft"), N("Pending"), N("Approved"), N("Posted"), N("Cancelled")));
            drafts += await sql.ExecuteScalarAsync<int>($"SELECT count(*)::int FROM {table} WHERE unit_code = @unit AND status = 'Draft' AND created_by = @user",
                new { unit = unitCode, user = userId }, ct);
        }

        var stock = CanView(StockFunction) ? await BuildStockAsync(userId, unitCode, today, ct) : null;
        var projects = CanView(ProjectFunction) ? await BuildProjectsAsync(userId, unitCode, ct) : null;

        var pending = await approvals.GetPendingForMeAsync(userId, unitCode, ct);
        var todo = new DashboardTodoDto(pending.Count, pending.Take(TopApprovals).ToList(), drafts);

        IReadOnlyList<DashboardActivityDto>? activity = null;
        if (CanView(AuditFunction))
        {
            var rows = await sql.QueryAsync<ActivityRow>(SqlScripts.Get(Module, "Activity"), new { unit = unitCode, top = TopRows }, ct);
            activity = rows.Select(x => new DashboardActivityDto(x.Time, x.ActorName, x.Function, x.Action, x.Label)).ToList();
        }

        return new DashboardDto(unitCode, key, from, today, DateTime.UtcNow, counts, stock, projects, todo, activity);
    }

    private async Task<DashboardStockDto> BuildStockAsync(int userId, string unitCode, DateOnly today, CancellationToken ct)
    {
        var canSeeCost = await permissions.HasRightAsync(userId, StockFunction, SpecialRightCatalog.ViewCost, ct);
        var warehouses = await sql.QueryAsync<WarehouseRow>(SqlScripts.Get(Module, "Warehouses"), new { unit = unitCode }, ct);
        var low = await sql.QueryAsync<LowStockRow>(SqlScripts.Get(Module, "LowStock"), new { unit = unitCode, top = TopRows }, ct);

        var firstMonth = new DateOnly(today.Year, today.Month, 1).AddMonths(1 - TrendMonths);
        var trendRows = await sql.QueryAsync<TrendRow>(SqlScripts.Get(Module, "Trend"), new { unit = unitCode, from = firstMonth.ToDateTime(TimeOnly.MinValue) }, ct);
        var trend = Enumerable.Range(0, TrendMonths).Select(i =>
        {
            var month = firstMonth.AddMonths(i).ToString("yyyy-MM");
            var receipt = trendRows.FirstOrDefault(r => r.Month == month && r.Kind == "R");
            var issue = trendRows.FirstOrDefault(r => r.Month == month && r.Kind == "I");
            return new DashboardTrendDto(month, receipt?.N ?? 0, issue?.N ?? 0, canSeeCost ? receipt?.Value ?? 0 : null, canSeeCost ? issue?.Value ?? 0 : null);
        }).ToList();

        return new DashboardStockDto(
            warehouses.Sum(w => w.ItemCount), low.Count == 0 ? 0 : low[0].TotalCount, canSeeCost ? warehouses.Sum(w => w.Value) : null,
            warehouses.Select(w => new DashboardWarehouseDto(w.Code, w.Name, w.ItemCount, canSeeCost ? w.Value : null)).ToList(),
            low.Select(x => new DashboardLowStockDto(x.MaterialCode, x.MaterialName, x.UomCode, x.Quantity, x.MinStock)).ToList(), trend);
    }

    private async Task<DashboardProjectsDto> BuildProjectsAsync(int userId, string unitCode, CancellationToken ct)
    {
        var canSeeCost = await permissions.HasRightAsync(userId, ProjectFunction, SpecialRightCatalog.ViewCost, ct);
        var active = await projectCost.GetAsync(unitCode, new ProjectCostQuery(ProjectStatus: "ACTIVE"), canSeeCost, ct);
        // Most used budget first; a project without a budget (or without the cost right) goes after, by code.
        var top = active.OrderByDescending(p => p.UsedPercent ?? -1m).ThenBy(p => p.Code).Take(TopProjects).ToList();
        return new DashboardProjectsDto(active.Count, canSeeCost ? active.Sum(p => p.Budget ?? 0) : null, canSeeCost ? active.Sum(p => p.IssuedValue ?? 0) : null, top);
    }
}
