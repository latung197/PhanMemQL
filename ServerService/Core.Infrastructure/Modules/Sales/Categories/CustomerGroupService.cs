using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Sales.Categories;
using Core.Domain.Common;
using Core.Domain.Modules.Sales.Categories.CustomerGroups;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Sales.Categories;

/// <summary>Danh mục nhóm khách hàng: a catalog on the shared CatalogService (code, name, note).</summary>
public sealed class CustomerGroupService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<CustomerGroup, CustomerGroupDto, SaveCustomerGroupRequest>(db, batch, excel, audit), ICustomerGroupService
{
    private static readonly CatalogSpec Info = new("sales_customer_group_cat", "customerGroup", "field.customerGroupCode", 20, "DanhMucNhomKhachHang", CodeChange: true);

    private static readonly SortMap<CustomerGroup> SortColumns = SortMap<CustomerGroup>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<CustomerGroup> Sorts => SortColumns;

    protected override IQueryable<CustomerGroup> Search(IQueryable<CustomerGroup> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern) || SearchFunctions.Matches(x.Note, pattern));

    protected override IReadOnlyList<ExportColumn<CustomerGroup>> ExportColumns() =>
    [
        new("export.customerGroup.code", x => x.Code), new("export.customerGroup.name", x => x.Name),
        new("export.customerGroup.note", x => x.Note), new("export.customerGroup.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveCustomerGroupRequest WithoutVersion(SaveCustomerGroupRequest request) => request with { Version = null };

    protected override Task<IReadOnlyList<CustomerGroupDto>> MapAsync(IReadOnlyList<CustomerGroup> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<CustomerGroupDto>>(rows.Select(x => new CustomerGroupDto(x.Code, x.Name, x.Note, x.IsActive, stamp(x), x.Version)).ToList());

    protected override async Task ApplyAsync(CustomerGroup row, SaveCustomerGroupRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.customerGroupName");
        if (await Db.CustomerGroups.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("customerGroup.nameExists", name);
        row.Name = name;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }
}
