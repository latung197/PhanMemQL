namespace Core.Application.Modules.Purchasing.Reports;

/// <summary>Filters of the project cost report; From / To cut the voucher dates (the project list is not cut).</summary>
public sealed record ProjectCostQuery(string? Project = null, string? ProjectStatus = null, string? Search = null, DateOnly? From = null, DateOnly? To = null);

/// <summary>
/// One project: its budget and what the vouchers of the unit add up to (all in the base currency, null without the VIEW_COST right).
/// OrderedValue = approved purchase orders (committed), ReceivedValue = posted goods receipts, IssuedValue = posted goods issues =
/// the actual cost the project consumed. Remaining = Budget - IssuedValue.
/// </summary>
public sealed record ProjectCostRowDto(string Code, string Name, string Status, string? CustomerName, string? ManagerName,
    DateOnly? StartDate, DateOnly? EndDate, decimal? Budget, decimal? OrderedValue, decimal? ReceivedValue, decimal? IssuedValue,
    decimal? Remaining, decimal? UsedPercent, int RequestCount, int OrderCount, int ReceiptCount, int IssueCount);

/// <summary>A voucher of a project: Kind = pur_request, pur_order, inv_receipt, inv_issue or inv_issue_request.</summary>
public sealed record ProjectCostVoucherDto(string Kind, long Id, string Code, DateOnly Date, string Status, string? Partner, decimal? Value);

public interface IProjectCostReport
{
    Task<IReadOnlyList<ProjectCostRowDto>> GetAsync(string unitCode, ProjectCostQuery query, bool canSeeCost, CancellationToken ct);
    /// <summary>The vouchers behind one project (all kinds, newest first).</summary>
    Task<IReadOnlyList<ProjectCostVoucherDto>> GetVouchersAsync(string unitCode, string projectCode, DateOnly? from, DateOnly? to, bool canSeeCost, CancellationToken ct);
}
