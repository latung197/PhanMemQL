using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Inventory;
using Core.Domain.Common;
using Core.Domain.Modules.Inventory;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

/// <summary>Danh mục nhóm vật tư: a plain catalog on the shared CatalogService (code, name, note, status).</summary>
public sealed class MaterialGroupService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<MaterialGroup, MaterialGroupDto, SaveMaterialGroupRequest>(db, batch, excel, audit), IMaterialGroupService
{
    private static readonly CatalogSpec Info = new("inv_material_group_cat", "materialGroup", "field.materialGroupCode", 20, "DanhMucNhomVatTu");

    private static readonly SortMap<MaterialGroup> SortColumns = SortMap<MaterialGroup>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name)
        .Add("note", x => x.Note).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<MaterialGroup> Sorts => SortColumns;

    protected override IQueryable<MaterialGroup> Search(IQueryable<MaterialGroup> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.Note, pattern));

    protected override IReadOnlyList<ExportColumn<MaterialGroup>> ExportColumns() =>
    [
        new("export.materialGroup.code", x => x.Code), new("export.materialGroup.name", x => x.Name),
        new("export.materialGroup.note", x => x.Note), new("export.materialGroup.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveMaterialGroupRequest WithoutVersion(SaveMaterialGroupRequest request) => request with { Version = null };

    protected override Task<IReadOnlyList<MaterialGroupDto>> MapAsync(IReadOnlyList<MaterialGroup> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<MaterialGroupDto>>(rows.Select(x =>
            new MaterialGroupDto(x.Code, x.Name, x.Note, x.IsActive, stamp(x), x.Version)).ToList());

    protected override async Task ApplyAsync(MaterialGroup row, SaveMaterialGroupRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.materialGroupName");
        if (await Db.MaterialGroups.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("materialGroup.nameExists", name);
        row.Name = name;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }
    // Materials are checked from their [References<MaterialGroup>] column once they have a backend; nothing else to do on delete.
}
