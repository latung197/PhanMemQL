using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Purchasing.Categories;
using Core.Domain.Common;
using Core.Domain.Modules.Purchasing.Categories.SupplierGroups;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Purchasing.Categories;

/// <summary>Danh mục nhóm nhà cung cấp: a catalog on the shared CatalogService (code, name, note).</summary>
public sealed class SupplierGroupService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<SupplierGroup, SupplierGroupDto, SaveSupplierGroupRequest>(db, batch, excel, audit), ISupplierGroupService
{
    private static readonly CatalogSpec Info = new("pur_supplier_group_cat", "supplierGroup", "field.supplierGroupCode", 20, "DanhMucNhomNhaCungCap", CodeChange: true);

    private static readonly SortMap<SupplierGroup> SortColumns = SortMap<SupplierGroup>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<SupplierGroup> Sorts => SortColumns;

    protected override IQueryable<SupplierGroup> Search(IQueryable<SupplierGroup> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern) || SearchFunctions.Matches(x.Note, pattern));

    protected override IReadOnlyList<ExportColumn<SupplierGroup>> ExportColumns() =>
    [
        new("export.supplierGroup.code", x => x.Code), new("export.supplierGroup.name", x => x.Name),
        new("export.supplierGroup.note", x => x.Note), new("export.supplierGroup.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveSupplierGroupRequest WithoutVersion(SaveSupplierGroupRequest request) => request with { Version = null };

    protected override Task<IReadOnlyList<SupplierGroupDto>> MapAsync(IReadOnlyList<SupplierGroup> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<SupplierGroupDto>>(rows.Select(x => new SupplierGroupDto(x.Code, x.Name, x.Note, x.IsActive, stamp(x), x.Version)).ToList());

    protected override async Task ApplyAsync(SupplierGroup row, SaveSupplierGroupRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.supplierGroupName");
        if (await Db.SupplierGroups.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("supplierGroup.nameExists", name);
        row.Name = name;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }
}
