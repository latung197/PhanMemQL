using Core.Application.Common.Exceptions;

namespace Core.Application.Modules.Inventory.Reports;

/// <summary>The rules of the stock reports that need no database, so they are tested on their own.</summary>
public static class StockReportRules
{
    /// <summary>A report that would list more rows than this asks the user to filter (the API is not paged; every row is read at once).</summary>
    public const int MaxRows = 20000;

    /// <summary>The period of a report: the month of <paramref name="today"/> when a side is missing; from may not be after to.</summary>
    public static (DateOnly From, DateOnly To) Period(DateOnly? from, DateOnly? to, DateOnly today)
    {
        var start = from ?? (to is { } end ? new DateOnly(end.Year, end.Month, 1) : new DateOnly(today.Year, today.Month, 1));
        var finish = to ?? (from is null ? today : new DateOnly(start.Year, start.Month, DateTime.DaysInMonth(start.Year, start.Month)));
        if (start > finish) throw new BusinessRuleException("report.dateRange");
        return (start, finish);
    }

    /// <summary>The first and last day of the month asked for (the month of <paramref name="today"/> when a side is missing); the month must be 1-12.</summary>
    public static (DateOnly From, DateOnly To) MonthPeriod(int? year, int? month, DateOnly today)
    {
        var y = year ?? today.Year;
        var m = month ?? today.Month;
        if (m is < 1 or > 12 || y is < 2000 or > 2100) throw new BusinessRuleException("report.monthInvalid");
        return (new DateOnly(y, m, 1), new DateOnly(y, m, DateTime.DaysInMonth(y, m)));
    }

    /// <summary>
    /// How the stock stands against the limits declared on the material: below the minimum, above the maximum, in between (ok), or none
    /// when the material has no limits. A limit of 0 or empty is "not declared".
    /// </summary>
    public static string Level(decimal quantity, decimal? minStock, decimal? maxStock)
    {
        var min = minStock is > 0 ? minStock : null;
        var max = maxStock is > 0 ? maxStock : null;
        if (min is null && max is null) return "none";
        if (min is { } low && quantity < low) return "below";
        if (max is { } high && quantity > high) return "over";
        return "ok";
    }

    /// <summary>detail (one row per stock line) or summary (one row per warehouse + material); anything else is refused.</summary>
    public static bool IsSummary(string? mode) => mode?.Trim().ToLowerInvariant() switch
    {
        null or "" or "detail" => false,
        "summary" => true,
        _ => throw new BusinessRuleException("report.modeInvalid")
    };

    /// <summary>The unit price of a stock line: value / quantity, to 4 decimals (0 without quantity).</summary>
    public static decimal AverageCost(decimal quantity, decimal value) => quantity == 0 ? 0 : decimal.Round(value / quantity, 4);
}
