namespace Core.Application.Modules.Purchasing.Reports;

/// <summary>
/// Filters of the payables report (công nợ phải trả). AsOf = the day the debt is looked at (default today): invoices booked on or before
/// it count, an invoice is overdue when its due date is before it. From cuts the booking dates from below.
/// </summary>
public sealed record PayableQuery(string? Supplier = null, string? Search = null, DateOnly? AsOf = null, DateOnly? From = null);

/// <summary>
/// One supplier: what the approved purchase invoices of the unit add up to (base currency, null without the VIEW_COST right), split into
/// not yet due and overdue, and the overdue part by age (1-30, 31-60, 61-90 and over 90 days past the due date). No payment is booked
/// yet, so the debt is the whole of the invoices; payments will take away from it when the payment vouchers are tied to invoices.
/// </summary>
public sealed record PayableRowDto(string SupplierCode, string SupplierName, int InvoiceCount, int OverdueCount, DateOnly? OldestDueDate,
    decimal? Total, decimal? NotDue, decimal? Overdue, decimal? Over1To30, decimal? Over31To60, decimal? Over61To90, decimal? Over90);

/// <summary>An invoice behind a supplier row. DaysOverdue is negative while the invoice is not yet due.</summary>
public sealed record PayableInvoiceDto(long Id, string Code, DateOnly Date, string InvoiceNo, string? InvoiceSeries, DateOnly InvoiceDate,
    DateOnly DueDate, int DaysOverdue, string CurrencyCode, decimal? Value);

public interface IPayableReport
{
    Task<IReadOnlyList<PayableRowDto>> GetAsync(string unitCode, PayableQuery query, bool canSeeCost, CancellationToken ct);
    /// <summary>The approved invoices behind one supplier (oldest due date first).</summary>
    Task<IReadOnlyList<PayableInvoiceDto>> GetInvoicesAsync(string unitCode, string supplierCode, DateOnly? asOf, DateOnly? from, bool canSeeCost, CancellationToken ct);
}
