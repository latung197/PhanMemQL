using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Production;
using Core.Domain.Common;
using Core.Domain.Modules.Production;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Production;

/// <summary>Danh mục công đoạn sản xuất: a catalog on the shared CatalogService (code, name, second name, team, flags).</summary>
public sealed class ProductionOperationService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<ProductionOperation, ProductionOperationDto, SaveProductionOperationRequest>(db, batch, excel, audit), IProductionOperationService
{
    private static readonly CatalogSpec Info = new("prod_operation_cat", "productionOperation", "field.productionOperationCode", 20, "DanhMucCongDoanSanXuat", CodeChange: true);

    private static readonly SortMap<ProductionOperation> SortColumns = SortMap<ProductionOperation>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("nameEn", x => x.NameEn)
        .Add("productionTeamCode", x => x.ProductionTeamCode).Add("requireMachine", x => x.RequireMachine).Add("isHeavy", x => x.IsHeavy)
        .Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<ProductionOperation> Sorts => SortColumns;

    protected override IQueryable<ProductionOperation> Search(IQueryable<ProductionOperation> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.NameEn, pattern) || SearchFunctions.Matches(x.ProductionTeamCode, pattern) || SearchFunctions.Matches(x.Note, pattern));

    /// <summary>Filter: <c>team=TBG1</c> keeps the operations of that team.</summary>
    protected override IQueryable<ProductionOperation> ApplyFilters(IQueryable<ProductionOperation> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("team", out var team) && !string.IsNullOrWhiteSpace(team))
        {
            var code = team.Trim().ToUpperInvariant();
            rows = rows.Where(x => x.ProductionTeamCode == code);
        }
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<ProductionOperation>> ExportColumns() =>
    [
        new("export.productionOperation.code", x => x.Code), new("export.productionOperation.name", x => x.Name),
        new("export.productionOperation.nameEn", x => x.NameEn), new("export.productionOperation.teamCode", x => x.ProductionTeamCode),
        new("export.productionOperation.requireMachine", x => YesNo(x.RequireMachine)), new("export.productionOperation.isHeavy", x => YesNo(x.IsHeavy)),
        new("export.productionOperation.note", x => x.Note), new("export.productionOperation.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveProductionOperationRequest WithoutVersion(SaveProductionOperationRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<ProductionOperationDto>> MapAsync(IReadOnlyList<ProductionOperation> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var codes = rows.Select(x => x.ProductionTeamCode).Where(x => x != null).Distinct().ToList();
        var teams = await Db.ProductionTeams.AsNoTracking().Where(x => codes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        return rows.Select(x => new ProductionOperationDto(x.Code, x.Name, x.NameEn, x.ProductionTeamCode,
            x.ProductionTeamCode is null ? null : teams.GetValueOrDefault(x.ProductionTeamCode),
            x.RequireMachine, x.IsHeavy, x.Note, x.IsActive, stamp(x), x.Version)).ToList();
    }

    protected override async Task ApplyAsync(ProductionOperation row, SaveProductionOperationRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 200, "field.productionOperationName");
        if (await Db.ProductionOperations.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("productionOperation.nameExists", name);
        var team = string.IsNullOrWhiteSpace(request.ProductionTeamCode) ? null : request.ProductionTeamCode.Trim().ToUpperInvariant();
        // A new assignment (or change) must point to a team that exists and is still in use; an unchanged one may keep an ended team.
        if (team is not null && team != row.ProductionTeamCode)
        {
            var active = await Db.ProductionTeams.Where(x => x.Code == team).Select(x => (bool?)x.IsActive).FirstOrDefaultAsync(ct);
            if (active is null) throw new BusinessRuleException("productionTeam.notFound");
            if (active == false) throw new BusinessRuleException("productionOperation.teamInactive", team);
        }
        row.Name = name;
        row.NameEn = Guard.Optional(request.NameEn, 200, "field.nameEn");
        row.ProductionTeamCode = team;
        row.RequireMachine = request.RequireMachine;
        row.IsHeavy = request.IsHeavy;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }
}
