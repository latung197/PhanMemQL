using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Departments;
using Core.Domain.Common;
using Core.Domain.Modules.Approvals;
using Core.Domain.Modules.Departments;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Departments;

/// <summary>Danh mục phòng ban: a plain catalog (code + name) on the shared CatalogService.</summary>
public sealed class DepartmentService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit, IUnitOfWork unitOfWork)
    : CatalogService<Department, DepartmentDto, SaveDepartmentRequest>(db, batch, excel, audit), IDepartmentService
{
    private static readonly CatalogSpec Info = new("sys_departments", "department", "field.departmentCode", 20, "DanhMucPhongBan");

    private static readonly SortMap<Department> SortColumns = SortMap<Department>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name)
        .Add("note", x => x.Note).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<Department> Sorts => SortColumns;

    protected override IQueryable<Department> Search(IQueryable<Department> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.Note, pattern));

    protected override IReadOnlyList<ExportColumn<Department>> ExportColumns() =>
    [
        new("export.department.code", x => x.Code), new("export.department.name", x => x.Name),
        new("export.department.note", x => x.Note), new("export.department.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveDepartmentRequest WithoutVersion(SaveDepartmentRequest request) => request with { Version = null };

    /// <summary>The number of accounts per department is read once for the whole page.</summary>
    protected override async Task<IReadOnlyList<DepartmentDto>> MapAsync(IReadOnlyList<Department> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var codes = rows.Select(x => x.Code).ToList();
        var counts = await Db.Users.AsNoTracking().Where(x => x.ValidFlg == 1 && x.DepartmentCode != null && codes.Contains(x.DepartmentCode))
            .GroupBy(x => x.DepartmentCode!).Select(g => new { Code = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Code, x => x.Count, ct);
        return rows.Select(x => new DepartmentDto(x.Code, x.Name, x.Note, x.IsActive, counts.GetValueOrDefault(x.Code), stamp(x), x.Version)).ToList();
    }

    public async Task<IReadOnlyList<DepartmentDto>> GetAllAsync(CancellationToken ct)
    {
        var rows = await Db.Departments.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync(ct);
        return await MapAsync(rows, await RecordStamps.ForAsync(Db, rows, ct), ct);
    }

    protected override async Task ApplyAsync(Department department, SaveDepartmentRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.departmentName");
        if (await Db.Departments.AnyAsync(x => x.Code != department.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("department.nameExists", name);
        department.Name = name;
        department.Note = Guard.Optional(request.Note, 300, "field.note");
        department.IsActive = request.IsActive;
    }

    /// <summary>Users keep the department name next to the code; a renamed department is copied to them in the same transaction.</summary>
    protected override Task SaveAsync(CancellationToken ct)
    {
        Db.ChangeTracker.DetectChanges();
        var renamed = Db.ChangeTracker.Entries<Department>()
            .Where(e => e.State == EntityState.Modified && e.Property(x => x.Name).IsModified)
            .Select(e => (e.Entity.Code, e.Entity.Name)).ToList();
        return unitOfWork.ExecuteAsync(async token =>
        {
            await Db.SaveChangesAsync(token);
            foreach (var (code, name) in renamed)
                await Db.Users.Where(x => x.DepartmentCode == code && x.Department != name)
                    .ExecuteUpdateAsync(s => s.SetProperty(x => x.Department, name), token);
        }, ct);
    }

    protected override async Task BeforeDeleteAsync(Department department, CancellationToken ct)
    {
        // Users keep the department by code but the column is not a [References] one (it counts only active accounts).
        var users = await Db.Users.CountAsync(x => x.ValidFlg == 1 && x.DepartmentCode == department.Code, ct);
        if (users > 0) throw new BusinessRuleException("department.hasUsers", department.Name, users);
        if (await Db.ApprovalRules.AnyAsync(x => x.RequesterType == RequesterTypes.Department && x.RequesterValue == department.Code, ct))
            throw new BusinessRuleException("department.inApprovalRules", department.Name);
    }
}
