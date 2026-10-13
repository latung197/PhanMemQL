using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Purchasing.Categories;
using Core.Domain.Common;
using Core.Domain.Modules.Purchasing.Categories.PaymentTerms;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Purchasing.Categories;

/// <summary>Danh mục điều khoản thanh toán: a catalog on the shared CatalogService (code, name, days to pay).</summary>
public sealed class PaymentTermService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<PaymentTerm, PaymentTermDto, SavePaymentTermRequest>(db, batch, excel, audit), IPaymentTermService
{
    private static readonly CatalogSpec Info = new("pur_payment_term_cat", "paymentTerm", "field.paymentTermCode", 20, "DanhMucDieuKhoanThanhToan", CodeChange: true);

    private static readonly SortMap<PaymentTerm> SortColumns = SortMap<PaymentTerm>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("days", x => x.Days)
        .Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<PaymentTerm> Sorts => SortColumns;

    protected override IQueryable<PaymentTerm> Search(IQueryable<PaymentTerm> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern) || SearchFunctions.Matches(x.Note, pattern));

    protected override IReadOnlyList<ExportColumn<PaymentTerm>> ExportColumns() =>
    [
        new("export.paymentTerm.code", x => x.Code), new("export.paymentTerm.name", x => x.Name), new("export.paymentTerm.days", x => x.Days),
        new("export.paymentTerm.note", x => x.Note), new("export.paymentTerm.isActive", x => YesNo(x.IsActive))
    ];

    protected override SavePaymentTermRequest WithoutVersion(SavePaymentTermRequest request) => request with { Version = null };

    protected override Task<IReadOnlyList<PaymentTermDto>> MapAsync(IReadOnlyList<PaymentTerm> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<PaymentTermDto>>(rows.Select(x => new PaymentTermDto(x.Code, x.Name, x.Days, x.Note, x.IsActive, stamp(x), x.Version)).ToList());

    protected override async Task ApplyAsync(PaymentTerm row, SavePaymentTermRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.paymentTermName");
        if (request.Days is < 0 or > 1000) throw new BusinessRuleException("paymentTerm.daysInvalid");
        if (await Db.PaymentTerms.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("paymentTerm.nameExists", name);
        row.Name = name;
        row.Days = request.Days;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }
}
