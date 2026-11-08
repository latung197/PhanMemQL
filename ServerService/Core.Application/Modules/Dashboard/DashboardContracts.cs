using Core.Application.Modules.Approvals;
using Core.Application.Modules.Purchasing.Reports;

namespace Core.Application.Modules.Dashboard;

/// <summary>Period of the counters of the dashboard: week, month, quarter or year (up to today).</summary>
public static class DashboardRanges
{
    public const string Week = "week", Month = "month", Quarter = "quarter", Year = "year";
    public static readonly string[] All = [Week, Month, Quarter, Year];

    /// <summary>First day of the period that ends on <paramref name="today"/>: Monday of this week, first of the month / quarter / year.</summary>
    public static DateOnly From(string range, DateOnly today) => range switch
    {
        Week => today.AddDays(-(((int)today.DayOfWeek + 6) % 7)),
        Quarter => new DateOnly(today.Year, (today.Month - 1) / 3 * 3 + 1, 1),
        Year => new DateOnly(today.Year, 1, 1),
        _ => new DateOnly(today.Year, today.Month, 1)
    };
}

/// <summary>Vouchers of one function in the period, counted by status (Draft, Pending, Approved, Posted, Cancelled).</summary>
public sealed record DashboardVoucherCountDto(string Function, int Draft, int Pending, int Approved, int Posted, int Cancelled);

/// <summary>Stock of one warehouse of the unit; Value is null without the VIEW_COST right of the stock report.</summary>
public sealed record DashboardWarehouseDto(string Code, string Name, int ItemCount, decimal? Value);

/// <summary>A stock item whose quantity in the unit is at or under its minimum stock.</summary>
public sealed record DashboardLowStockDto(string MaterialCode, string MaterialName, string UomCode, decimal Quantity, decimal MinStock);

/// <summary>Posted receipts / issues of one month (Month = yyyy-MM); values are null without the VIEW_COST right.</summary>
public sealed record DashboardTrendDto(string Month, int ReceiptCount, int IssueCount, decimal? ReceiptValue, decimal? IssueValue);

public sealed record DashboardStockDto(int ItemCount, int LowStockCount, decimal? TotalValue,
    IReadOnlyList<DashboardWarehouseDto> Warehouses, IReadOnlyList<DashboardLowStockDto> LowStock, IReadOnlyList<DashboardTrendDto> Trend);

/// <summary>Active projects of the unit; the money values are null without the VIEW_COST right of the project cost report.</summary>
public sealed record DashboardProjectsDto(int ActiveCount, decimal? Budget, decimal? Spent, IReadOnlyList<ProjectCostRowDto> Top);

/// <summary>An item of the activity list: the change log of the unit (only for users who may view it).</summary>
public sealed record DashboardActivityDto(DateTime Time, string? ActorName, string Function, string Action, string? Label);

/// <summary>What the user has to do: approvals waiting for them and their own drafts.</summary>
public sealed record DashboardTodoDto(int PendingApprovalCount, IReadOnlyList<PendingApprovalDto> PendingApprovals, int DraftCount);

/// <summary>
/// The dashboard of the working unit, all from real data. A part the user has no right for is null (Stock, Projects, Activity) or
/// left out (Vouchers lists only the functions the user may view); money is null without its VIEW_COST right.
/// </summary>
public sealed record DashboardDto(string UnitCode, string Range, DateOnly From, DateOnly To, DateTime GeneratedAt,
    IReadOnlyList<DashboardVoucherCountDto> Vouchers, DashboardStockDto? Stock, DashboardProjectsDto? Projects,
    DashboardTodoDto Todo, IReadOnlyList<DashboardActivityDto>? Activity);

public interface IDashboardService
{
    Task<DashboardDto> GetAsync(int userId, string unitCode, string? range, CancellationToken ct);
}
