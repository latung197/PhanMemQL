using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Purchasing.Categories;
using Core.Domain.Common;
using Core.Domain.Modules.Purchasing.Categories.Projects;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Purchasing.Categories;

/// <summary>Danh mục dự án: a catalog on the shared CatalogService (code, name, department, customer, manager, dates, budget, status).</summary>
public sealed class ProjectService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<Project, ProjectDto, SaveProjectRequest>(db, batch, excel, audit), IProjectService
{
    private static readonly CatalogSpec Info = new("pur_project_cat", "project", "field.projectCode", 20, "DanhMucDuAn", CodeChange: true);

    private static readonly SortMap<Project> SortColumns = SortMap<Project>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("departmentCode", x => x.DepartmentCode)
        .Add("customerName", x => x.CustomerName).Add("managerName", x => x.ManagerName).Add("startDate", x => x.StartDate)
        .Add("endDate", x => x.EndDate).Add("budget", x => x.Budget).Add("projectStatus", x => x.Status)
        .Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<Project> Sorts => SortColumns;

    protected override IQueryable<Project> Search(IQueryable<Project> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.CustomerName, pattern) || SearchFunctions.Matches(x.ManagerName, pattern));

    /// <summary>Filters: <c>projectStatus=ACTIVE</c> (or PLANNING, ONHOLD, DONE, CANCELLED) and <c>department=PB01</c>.</summary>
    protected override IQueryable<Project> ApplyFilters(IQueryable<Project> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("projectStatus", out var status) && !string.IsNullOrWhiteSpace(status))
        {
            var code = status.Trim().ToUpperInvariant();
            rows = rows.Where(x => x.Status == code);
        }
        if (filters.TryGetValue("department", out var department) && !string.IsNullOrWhiteSpace(department))
        {
            var code = department.Trim().ToUpperInvariant();
            rows = rows.Where(x => x.DepartmentCode == code);
        }
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<Project>> ExportColumns() =>
    [
        new("export.project.code", x => x.Code), new("export.project.name", x => x.Name),
        new("export.project.departmentCode", x => x.DepartmentCode), new("export.project.customerName", x => x.CustomerName),
        new("export.project.managerName", x => x.ManagerName),
        new("export.project.startDate", x => x.StartDate?.ToString("yyyy-MM-dd")), new("export.project.endDate", x => x.EndDate?.ToString("yyyy-MM-dd")),
        new("export.project.budget", x => x.Budget), new("export.project.status", x => x.Status),
        new("export.project.note", x => x.Note), new("export.project.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveProjectRequest WithoutVersion(SaveProjectRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<ProjectDto>> MapAsync(IReadOnlyList<Project> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var codes = rows.Select(x => x.DepartmentCode).Where(x => x != null).Distinct().ToList();
        var departments = await Db.Departments.AsNoTracking().Where(x => codes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        return rows.Select(x => new ProjectDto(x.Code, x.Name, x.DepartmentCode,
            x.DepartmentCode is null ? null : departments.GetValueOrDefault(x.DepartmentCode), x.CustomerName, x.ManagerName,
            x.StartDate, x.EndDate, x.Budget, x.Status, x.Note, x.IsActive, stamp(x), x.Version)).ToList();
    }

    protected override async Task ApplyAsync(Project row, SaveProjectRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 200, "field.projectName");
        var status = (request.Status ?? string.Empty).Trim().ToUpperInvariant();
        if (!ProjectStatuses.All.Contains(status)) throw new BusinessRuleException("project.statusInvalid");
        if (request.StartDate is { } start && request.EndDate is { } end && end < start) throw new BusinessRuleException("project.dateOrder");
        if (request.Budget < 0 || decimal.Round(request.Budget, 2) != request.Budget) throw new BusinessRuleException("project.budgetInvalid");
        if (await Db.Projects.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("project.nameExists", name);
        row.Name = name;
        row.DepartmentCode = string.IsNullOrWhiteSpace(request.DepartmentCode) ? null : request.DepartmentCode.Trim().ToUpperInvariant();
        row.CustomerName = Guard.Optional(request.CustomerName, 200, "field.customerName");
        row.ManagerName = Guard.Optional(request.ManagerName, 100, "field.managerName");
        row.StartDate = request.StartDate;
        row.EndDate = request.EndDate;
        row.Budget = request.Budget;
        row.Status = status;
        row.Note = Guard.Optional(request.Note, 500, "field.note");
        row.IsActive = request.IsActive;
    }
    // A project that vouchers still point to cannot be deleted: their [References<Project>] columns are checked by the framework.
}
