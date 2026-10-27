using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Sales.Categories;
using Core.Domain.Common;
using Core.Domain.Modules.Sales.Categories.Customers;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Sales.Categories;

/// <summary>
/// Danh mục khách hàng: a catalog on the shared CatalogService (code, name, tax code, contact, group, default payment term, credit limit).
/// A tax code, when given, belongs to one customer only.
/// </summary>
public sealed class CustomerService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<Customer, CustomerDto, SaveCustomerRequest>(db, batch, excel, audit), ICustomerService
{
    private static readonly CatalogSpec Info = new("sales_customers", "customer", "field.customerCode", 20, "DanhMucKhachHang", CodeChange: true);

    private static readonly SortMap<Customer> SortColumns = SortMap<Customer>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("taxCode", x => x.TaxCode)
        .Add("creditLimit", x => x.CreditLimit).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<Customer> Sorts => SortColumns;

    protected override IQueryable<Customer> Search(IQueryable<Customer> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.TaxCode, pattern) || SearchFunctions.Matches(x.Phone, pattern)
            || SearchFunctions.Matches(x.ContactName, pattern) || SearchFunctions.Matches(x.Email, pattern));

    /// <summary>Filter: <c>group=KH-DL</c> (customer group).</summary>
    protected override IQueryable<Customer> ApplyFilters(IQueryable<Customer> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("group", out var group) && !string.IsNullOrWhiteSpace(group))
        {
            var code = group.Trim().ToUpperInvariant();
            rows = rows.Where(x => x.CustomerGroupCode == code);
        }
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<Customer>> ExportColumns() =>
    [
        new("export.customer.code", x => x.Code), new("export.customer.name", x => x.Name),
        new("export.customer.taxCode", x => x.TaxCode), new("export.customer.phone", x => x.Phone),
        new("export.customer.email", x => x.Email), new("export.customer.contactName", x => x.ContactName),
        new("export.customer.address", x => x.Address), new("export.customer.customerGroupCode", x => x.CustomerGroupCode),
        new("export.customer.paymentTermCode", x => x.PaymentTermCode), new("export.customer.creditLimit", x => x.CreditLimit),
        new("export.customer.note", x => x.Note), new("export.customer.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveCustomerRequest WithoutVersion(SaveCustomerRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<CustomerDto>> MapAsync(IReadOnlyList<Customer> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var groupCodes = rows.Select(x => x.CustomerGroupCode).Where(x => x != null).Distinct().ToList();
        var groups = await Db.CustomerGroups.AsNoTracking().Where(x => groupCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var termCodes = rows.Select(x => x.PaymentTermCode).Where(x => x != null).Distinct().ToList();
        var terms = await Db.PaymentTerms.AsNoTracking().Where(x => termCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        return rows.Select(x => new CustomerDto(x.Code, x.Name, x.TaxCode, x.Phone, x.Email, x.ContactName, x.Address,
            x.CustomerGroupCode, x.CustomerGroupCode is null ? null : groups.GetValueOrDefault(x.CustomerGroupCode),
            x.PaymentTermCode, x.PaymentTermCode is null ? null : terms.GetValueOrDefault(x.PaymentTermCode),
            x.CreditLimit, x.Note, x.IsActive, stamp(x), x.Version)).ToList();
    }

    protected override async Task ApplyAsync(Customer row, SaveCustomerRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 200, "field.customerName");
        var taxCode = Guard.Optional(request.TaxCode, 30, "field.taxCode");
        if (taxCode is not null && await Db.Customers.AnyAsync(x => x.Code != row.Code && x.TaxCode == taxCode, ct))
            throw new BusinessRuleException("customer.taxCodeExists", taxCode);
        if (request.CreditLimit < 0 || decimal.Round(request.CreditLimit, 2) != request.CreditLimit)
            throw new BusinessRuleException("customer.creditLimitInvalid");
        row.Name = name;
        row.TaxCode = taxCode;
        row.Phone = Guard.Optional(request.Phone, 30, "field.phone");
        row.Email = Guard.Optional(request.Email, 100, "field.email");
        row.ContactName = Guard.Optional(request.ContactName, 100, "field.contactName");
        row.Address = Guard.Optional(request.Address, 300, "field.address");
        row.CustomerGroupCode = string.IsNullOrWhiteSpace(request.CustomerGroupCode) ? null : request.CustomerGroupCode.Trim().ToUpperInvariant();
        row.PaymentTermCode = string.IsNullOrWhiteSpace(request.PaymentTermCode) ? null : request.PaymentTermCode.Trim().ToUpperInvariant();
        row.CreditLimit = request.CreditLimit;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }
    // A customer that price lists, vouchers... point to cannot be deleted: their [References<Customer>] columns are checked by the framework.
}
