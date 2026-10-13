using Core.Application.Common.Exceptions;
using Core.Infrastructure.Common.Paging;
using Core.Application.Common.Persistence;
using Core.Application.Modules.Purchasing.Reports;
using Core.Infrastructure.Common.Persistence.Sql;

namespace Core.Infrastructure.Modules.Purchasing.Reports;

/// <summary>Cost per project of the company unit of the request (SQL files in Sql/). Values are null without the VIEW_COST right.</summary>
public sealed class ProjectCostService(ISqlExecutor sql) : IProjectCostReport
{
    private const string Module = "Purchasing.Reports";
    private static readonly string[] ProjectStatuses = ["PLANNING", "ACTIVE", "ONHOLD", "DONE", "CANCELLED"];

    private sealed class CostRow
    {
        public string Code { get; set; } = "";
        public string Name { get; set; } = "";
        public string Status { get; set; } = "";
        public string? CustomerName { get; set; }
        public string? ManagerName { get; set; }
        public DateOnly? StartDate { get; set; }
        public DateOnly? EndDate { get; set; }
        public decimal Budget { get; set; }
        public decimal OrderedValue { get; set; }
        public decimal ReceivedValue { get; set; }
        public decimal IssuedValue { get; set; }
        public int RequestCount { get; set; }
        public int OrderCount { get; set; }
        public int ReceiptCount { get; set; }
        public int IssueCount { get; set; }
    }

    private sealed class VoucherRow
    {
        public string Kind { get; set; } = "";
        public long Id { get; set; }
        public string Code { get; set; } = "";
        public DateOnly Date { get; set; }
        public string Status { get; set; } = "";
        public string? Partner { get; set; }
        public decimal Value { get; set; }
    }

    public async Task<IReadOnlyList<ProjectCostRowDto>> GetAsync(string unitCode, ProjectCostQuery query, bool canSeeCost, CancellationToken ct)
    {
        var status = string.IsNullOrWhiteSpace(query.ProjectStatus) ? null : query.ProjectStatus.Trim().ToUpperInvariant();
        if (status is not null && !ProjectStatuses.Contains(status)) throw new BusinessRuleException("project.statusInvalid");
        var rows = await sql.QueryAsync<CostRow>(SqlScripts.Get(Module, "ProjectCost"), new
        {
            unit = unitCode, project = Code(query.Project), status,
            search = string.IsNullOrWhiteSpace(query.Search) ? null : PagingExtensions.ContainsPattern(query.Search),
            from = query.From?.ToDateTime(TimeOnly.MinValue), to = query.To?.ToDateTime(TimeOnly.MinValue)
        }, ct);
        return rows.Select(x => new ProjectCostRowDto(x.Code, x.Name, x.Status, x.CustomerName, x.ManagerName, x.StartDate, x.EndDate,
            canSeeCost ? x.Budget : null, canSeeCost ? x.OrderedValue : null, canSeeCost ? x.ReceivedValue : null, canSeeCost ? x.IssuedValue : null,
            canSeeCost ? x.Budget - x.IssuedValue : null,
            canSeeCost && x.Budget > 0 ? Math.Round(x.IssuedValue * 100m / x.Budget, 1) : null,
            x.RequestCount, x.OrderCount, x.ReceiptCount, x.IssueCount)).ToList();
    }

    public async Task<IReadOnlyList<ProjectCostVoucherDto>> GetVouchersAsync(string unitCode, string projectCode, DateOnly? from, DateOnly? to, bool canSeeCost, CancellationToken ct)
    {
        var rows = await sql.QueryAsync<VoucherRow>(SqlScripts.Get(Module, "ProjectCostVouchers"), new
        {
            unit = unitCode, project = Code(projectCode), from = from?.ToDateTime(TimeOnly.MinValue), to = to?.ToDateTime(TimeOnly.MinValue)
        }, ct);
        return rows.Select(x => new ProjectCostVoucherDto(x.Kind, x.Id, x.Code, x.Date, x.Status, x.Partner, canSeeCost ? x.Value : null)).ToList();
    }

    private static string? Code(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();
}
