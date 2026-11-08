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

/// <summary>Danh mục tổ sản xuất: a catalog on the shared CatalogService (code, name, note).</summary>
public sealed class ProductionTeamService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<ProductionTeam, ProductionTeamDto, SaveProductionTeamRequest>(db, batch, excel, audit), IProductionTeamService
{
    private static readonly CatalogSpec Info = new("prod_team_cat", "productionTeam", "field.productionTeamCode", 20, "DanhMucToSanXuat", CodeChange: true);

    private static readonly SortMap<ProductionTeam> SortColumns = SortMap<ProductionTeam>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<ProductionTeam> Sorts => SortColumns;

    protected override IQueryable<ProductionTeam> Search(IQueryable<ProductionTeam> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern) || SearchFunctions.Matches(x.Note, pattern));

    protected override IReadOnlyList<ExportColumn<ProductionTeam>> ExportColumns() =>
    [
        new("export.productionTeam.code", x => x.Code), new("export.productionTeam.name", x => x.Name),
        new("export.productionTeam.note", x => x.Note), new("export.productionTeam.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveProductionTeamRequest WithoutVersion(SaveProductionTeamRequest request) => request with { Version = null };

    protected override Task<IReadOnlyList<ProductionTeamDto>> MapAsync(IReadOnlyList<ProductionTeam> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<ProductionTeamDto>>(rows.Select(x => new ProductionTeamDto(x.Code, x.Name, x.Note, x.IsActive, stamp(x), x.Version)).ToList());

    protected override async Task ApplyAsync(ProductionTeam row, SaveProductionTeamRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.productionTeamName");
        if (await Db.ProductionTeams.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("productionTeam.nameExists", name);
        row.Name = name;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }
}
