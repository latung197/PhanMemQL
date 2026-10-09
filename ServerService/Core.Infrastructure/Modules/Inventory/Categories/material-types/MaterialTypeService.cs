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

/// <summary>Danh mục loại vật tư: a catalog on the shared CatalogService (code, name, group text, note, status).</summary>
public sealed class MaterialTypeService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<MaterialType, MaterialTypeDto, SaveMaterialTypeRequest>(db, batch, excel, audit), IMaterialTypeService
{
    private static readonly CatalogSpec Info = new("inv_material_type_cat", "materialType", "field.materialTypeCode", 20, "DanhMucLoaiVatTu");

    private static readonly SortMap<MaterialType> SortColumns = SortMap<MaterialType>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("groupName", x => x.GroupName)
        .Add("note", x => x.Note).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<MaterialType> Sorts => SortColumns;

    protected override IQueryable<MaterialType> Search(IQueryable<MaterialType> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.GroupName, pattern) || SearchFunctions.Matches(x.Note, pattern));

    /// <summary>Filter: <c>group=Vật tư sản xuất</c> (the group text, exact, ignoring case).</summary>
    protected override IQueryable<MaterialType> ApplyFilters(IQueryable<MaterialType> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("group", out var group) && !string.IsNullOrWhiteSpace(group))
        {
            var text = group.Trim().ToLower();
            rows = rows.Where(x => x.GroupName != null && x.GroupName.ToLower() == text);
        }
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<MaterialType>> ExportColumns() =>
    [
        new("export.materialType.code", x => x.Code), new("export.materialType.name", x => x.Name),
        new("export.materialType.groupName", x => x.GroupName), new("export.materialType.note", x => x.Note),
        new("export.materialType.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveMaterialTypeRequest WithoutVersion(SaveMaterialTypeRequest request) => request with { Version = null };

    protected override Task<IReadOnlyList<MaterialTypeDto>> MapAsync(IReadOnlyList<MaterialType> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<MaterialTypeDto>>(rows.Select(x =>
            new MaterialTypeDto(x.Code, x.Name, x.GroupName, x.Note, x.IsActive, stamp(x), x.Version)).ToList());

    protected override async Task ApplyAsync(MaterialType row, SaveMaterialTypeRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.materialTypeName");
        if (await Db.MaterialTypes.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("materialType.nameExists", name);
        row.Name = name;
        row.GroupName = Guard.Optional(request.GroupName, 100, "field.groupName");
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }
    // Materials are checked from their [References<MaterialType>] column once they have a backend; nothing else to do on delete.
}
