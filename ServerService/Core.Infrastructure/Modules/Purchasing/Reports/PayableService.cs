using Core.Application.Common.Persistence;
using Core.Application.Modules.Purchasing.Reports;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence.Sql;

namespace Core.Infrastructure.Modules.Purchasing.Reports;

/// <summary>Payables per supplier of the company unit of the request (SQL files in Sql/). Values are null without the VIEW_COST right.</summary>
public sealed class PayableService(ISqlExecutor sql) : IPayableReport
{
    private const string Module = "Purchasing.Reports";

    private sealed class SupplierRow
    {
        public string SupplierCode { get; set; } = "";
        public string SupplierName { get; set; } = "";
        public int InvoiceCount { get; set; }
        public int OverdueCount { get; set; }
        public DateOnly? OldestDueDate { get; set; }
        public decimal Total { get; set; }
        public decimal NotDue { get; set; }
        public decimal Overdue { get; set; }
        public decimal Over1To30 { get; set; }
        public decimal Over31To60 { get; set; }
        public decimal Over61To90 { get; set; }
        public decimal Over90 { get; set; }
    }

    private sealed class InvoiceRow
    {
        public long Id { get; set; }
        public string Code { get; set; } = "";
        public DateOnly Date { get; set; }
        public string InvoiceNo { get; set; } = "";
        public string? InvoiceSeries { get; set; }
        public DateOnly InvoiceDate { get; set; }
        public DateOnly DueDate { get; set; }
        public int DaysOverdue { get; set; }
        public string CurrencyCode { get; set; } = "";
        public decimal Value { get; set; }
    }

    private static DateTime AsOf(DateOnly? value) => (value ?? DateOnly.FromDateTime(DateTime.UtcNow)).ToDateTime(TimeOnly.MinValue);

    public async Task<IReadOnlyList<PayableRowDto>> GetAsync(string unitCode, PayableQuery query, bool canSeeCost, CancellationToken ct)
    {
        var rows = await sql.QueryAsync<SupplierRow>(SqlScripts.Get(Module, "Payables"), new
        {
            unit = unitCode, supplier = Code(query.Supplier), asof = AsOf(query.AsOf), from = query.From?.ToDateTime(TimeOnly.MinValue),
            search = string.IsNullOrWhiteSpace(query.Search) ? null : PagingExtensions.ContainsPattern(query.Search)
        }, ct);
        return rows.Select(x => new PayableRowDto(x.SupplierCode, x.SupplierName, x.InvoiceCount, x.OverdueCount, x.OldestDueDate,
            canSeeCost ? x.Total : null, canSeeCost ? x.NotDue : null, canSeeCost ? x.Overdue : null, canSeeCost ? x.Over1To30 : null,
            canSeeCost ? x.Over31To60 : null, canSeeCost ? x.Over61To90 : null, canSeeCost ? x.Over90 : null)).ToList();
    }

    public async Task<IReadOnlyList<PayableInvoiceDto>> GetInvoicesAsync(string unitCode, string supplierCode, DateOnly? asOf, DateOnly? from, bool canSeeCost, CancellationToken ct)
    {
        var rows = await sql.QueryAsync<InvoiceRow>(SqlScripts.Get(Module, "PayableInvoices"), new
        {
            unit = unitCode, supplier = Code(supplierCode), asof = AsOf(asOf), from = from?.ToDateTime(TimeOnly.MinValue)
        }, ct);
        return rows.Select(x => new PayableInvoiceDto(x.Id, x.Code, x.Date, x.InvoiceNo, x.InvoiceSeries, x.InvoiceDate, x.DueDate,
            x.DaysOverdue, x.CurrencyCode, canSeeCost ? x.Value : null)).ToList();
    }

    private static string? Code(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();
}
