using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.{{PhanHe}}.Categories;
using Core.Domain.Common;
using Core.Domain.Modules.{{PhanHe}};
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.{{PhanHe}}.Categories;

/// <summary>{{tenVi}} ({{ma}}) on the shared CatalogService. Rules special to this catalog go in ApplyAsync.</summary>
public sealed class {{Ten}}Service(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<{{Ten}}, {{Ten}}Dto, Save{{Ten}}Request>(db, batch, excel, audit), I{{Ten}}Service
{
    private static readonly CatalogSpec Info = new("{{ma}}", "{{ten}}", "field.{{ten}}Code", 20, "{{tenFile}}");

    private static readonly SortMap<{{Ten}}> SortColumns = SortMap<{{Ten}}>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<{{Ten}}> Sorts => SortColumns;

    protected override IQueryable<{{Ten}}> Search(IQueryable<{{Ten}}> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern) || SearchFunctions.Matches(x.Note, pattern));

    protected override IReadOnlyList<ExportColumn<{{Ten}}>> ExportColumns() =>
    [
        new("export.{{ten}}.code", x => x.Code),
        new("export.{{ten}}.name", x => x.Name),
        new("export.{{ten}}.note", x => x.Note),
        new("export.{{ten}}.isActive", x => YesNo(x.IsActive))
    ];

    protected override Save{{Ten}}Request WithoutVersion(Save{{Ten}}Request request) => request with { Version = null };

    protected override Task<IReadOnlyList<{{Ten}}Dto>> MapAsync(IReadOnlyList<{{Ten}}> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<{{Ten}}Dto>>(rows.Select(x => new {{Ten}}Dto(x.Code, x.Name, x.Note, x.IsActive, stamp(x), x.Version)).ToList());

    protected override async Task ApplyAsync({{Ten}} row, Save{{Ten}}Request request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 200, "field.{{ten}}Name");
        if (await Db.{{Tens}}.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("{{ten}}.nameExists", name);
        row.Name = name;
        row.Note = Guard.Optional(request.Note, 300, "field.{{ten}}Note");
        row.IsActive = request.IsActive;
    }
}
