using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.TaxRates;
using Core.Domain.Common;
using Core.Domain.Modules.TaxRates;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.TaxRates;

/// <summary>Danh mục mã thuế: a catalog on the shared CatalogService (code, name, type, rate, exempt flag).</summary>
public sealed class TaxRateService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<TaxRate, TaxRateDto, SaveTaxRateRequest>(db, batch, excel, audit), ITaxRateService
{
    private static readonly CatalogSpec Info = new("sys_tax_rates", "taxRate", "field.taxRateCode", 20, "DanhMucMaThue");

    private static readonly SortMap<TaxRate> SortColumns = SortMap<TaxRate>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("taxType", x => x.TaxType)
        .Add("rate", x => x.Rate).Add("isExempt", x => x.IsExempt).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<TaxRate> Sorts => SortColumns;

    protected override IQueryable<TaxRate> Search(IQueryable<TaxRate> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.Note, pattern));

    /// <summary>Filter: <c>type=VAT</c> (or IMPORT, OTHER).</summary>
    protected override IQueryable<TaxRate> ApplyFilters(IQueryable<TaxRate> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("type", out var type) && !string.IsNullOrWhiteSpace(type))
        {
            var code = type.Trim().ToUpperInvariant();
            rows = rows.Where(x => x.TaxType == code);
        }
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<TaxRate>> ExportColumns() =>
    [
        new("export.taxRate.code", x => x.Code), new("export.taxRate.name", x => x.Name), new("export.taxRate.taxType", x => x.TaxType),
        new("export.taxRate.rate", x => x.Rate), new("export.taxRate.isExempt", x => YesNo(x.IsExempt)),
        new("export.taxRate.note", x => x.Note), new("export.taxRate.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveTaxRateRequest WithoutVersion(SaveTaxRateRequest request) => request with { Version = null };

    protected override Task<IReadOnlyList<TaxRateDto>> MapAsync(IReadOnlyList<TaxRate> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<TaxRateDto>>(rows.Select(x =>
            new TaxRateDto(x.Code, x.Name, x.TaxType, x.Rate, x.IsExempt, x.Note, x.IsActive, stamp(x), x.Version)).ToList());

    protected override async Task ApplyAsync(TaxRate row, SaveTaxRateRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "field.taxRateName");
        var type = (request.TaxType ?? string.Empty).Trim().ToUpperInvariant();
        if (!TaxTypes.All.Contains(type)) throw new BusinessRuleException("taxRate.typeInvalid");
        if (request.Rate is < 0 or > 100) throw new BusinessRuleException("taxRate.rateRange");
        if (request.IsExempt && request.Rate != 0) throw new BusinessRuleException("taxRate.exemptNoRate");
        if (await Db.TaxRates.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("taxRate.nameExists", name);
        row.Name = name;
        row.TaxType = type;
        row.Rate = Math.Round(request.Rate, 4);
        row.IsExempt = request.IsExempt;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }
    // Materials and vouchers are checked from their [References<TaxRate>] columns once they have a backend.
}
