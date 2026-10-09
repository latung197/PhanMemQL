using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Currencies;
using Core.Domain.Common;
using Core.Domain.Modules.Currencies;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Currencies;

/// <summary>Danh mục ngoại tệ: a catalog on CatalogService with one base (accounting) currency.</summary>
public sealed class CurrencyService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit, IUnitOfWork unitOfWork)
    : CatalogService<Currency, CurrencyDto, SaveCurrencyRequest>(db, batch, excel, audit), ICurrencyService
{
    private static readonly CatalogSpec Info = new("sys_currencies", "currency", "field.currencyCode", 10, "DanhMucNgoaiTe");

    private static readonly SortMap<Currency> SortColumns = SortMap<Currency>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("symbol", x => x.Symbol)
        .Add("decimalPlaces", x => x.DecimalPlaces).Add("isBase", x => x.IsBase).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<Currency> Sorts => SortColumns;

    protected override IQueryable<Currency> Search(IQueryable<Currency> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.Symbol, pattern));

    protected override IReadOnlyList<ExportColumn<Currency>> ExportColumns() =>
    [
        new("export.currency.code", x => x.Code), new("export.currency.name", x => x.Name), new("export.currency.symbol", x => x.Symbol),
        new("export.currency.decimalPlaces", x => x.DecimalPlaces), new("export.currency.isBase", x => YesNo(x.IsBase)),
        new("export.currency.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveCurrencyRequest WithoutVersion(SaveCurrencyRequest request) => request with { Version = null };

    protected override Task<IReadOnlyList<CurrencyDto>> MapAsync(IReadOnlyList<Currency> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<CurrencyDto>>(rows.Select(x =>
            new CurrencyDto(x.Code, x.Name, x.Symbol, x.DecimalPlaces, x.IsBase, x.IsActive, stamp(x), x.Version)).ToList());

    public async Task<IReadOnlyList<CurrencyDto>> GetAllAsync(CancellationToken ct)
    {
        var rows = await Db.Currencies.AsNoTracking().OrderByDescending(x => x.IsBase).ThenBy(x => x.SortOrder).ThenBy(x => x.Code).ToListAsync(ct);
        return await MapAsync(rows, await RecordStamps.ForAsync(Db, rows, ct), ct);
    }

    protected override Task ApplyAsync(Currency currency, SaveCurrencyRequest request, CancellationToken ct)
    {
        if (request.DecimalPlaces is < 0 or > 6) throw new BusinessRuleException("currency.decimalPlaces");
        if (currency.IsBase && !request.IsBase) throw new BusinessRuleException("currency.keepBase");
        currency.Name = Guard.Required(request.Name, 100, "field.currencyName");
        currency.Symbol = Guard.Optional(request.Symbol, 10, "field.symbol") ?? string.Empty;
        currency.DecimalPlaces = (short)request.DecimalPlaces;
        currency.IsBase = request.IsBase;
        currency.IsActive = request.IsActive || request.IsBase;
        return Task.CompletedTask;
    }

    /// <summary>
    /// Only one base currency (unique index ux_sys_currency_base): choosing a new one clears the old one first, in the
    /// same transaction. EF would otherwise write the new base before clearing the old one and break the index.
    /// </summary>
    protected override Task SaveAsync(CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        var chosen = Db.ChangeTracker.Entries<Currency>()
            .FirstOrDefault(e => e.State is EntityState.Added or EntityState.Modified && e.Entity.IsBase)?.Entity;
        if (chosen is not null)
        {
            var old = Db.Currencies.Where(x => x.IsBase && x.Code != chosen.Code);
            // ExecuteUpdate bypasses the automatic log: the old base currency is logged by hand.
            foreach (var x in await old.AsNoTracking().ToListAsync(token))
                await AuditLog.RecordAsync(new AuditEntry("sys_currencies", "currency", x.Code, $"{x.Code} - {x.Name}",
                    AuditActions.Update, [new AuditChange("isBase", "true", "false")]), token);
            await old.ExecuteUpdateAsync(s => s.SetProperty(x => x.IsBase, false), token);
        }
        await Db.SaveChangesAsync(token);
    }, ct);

    protected override Task BeforeDeleteAsync(Currency currency, CancellationToken ct) =>
        // Exchange rates and vouchers are checked from their [References<Currency>] columns.
        currency.IsBase ? throw new BusinessRuleException("currency.deleteBase") : Task.CompletedTask;
}
