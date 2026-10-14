using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory.Documents.Transfers;

/// <summary>
/// How far a transfer has gone, always computed from the later vouchers that are not cancelled (nothing is stored): what the issues
/// transfer of an order line, what the receipts receive of an issue line. <c>except...</c> is the voucher being edited, which does
/// not count against itself.
/// </summary>
public static class TransferProgress
{
    public static async Task<Dictionary<long, decimal>> IssuedByOrderLineAsync(CoreContext db, IReadOnlyCollection<long> orderLineIds,
        long? exceptIssueId, CancellationToken ct)
    {
        if (orderLineIds.Count == 0) return [];
        var rows = await (from line in db.TransferIssueLines.AsNoTracking()
                          join issue in db.TransferIssues.AsNoTracking() on line.IssueId equals issue.Id
                          where line.TransferOrderLineId != null && orderLineIds.Contains(line.TransferOrderLineId.Value)
                                && issue.Status != "Cancelled" && (exceptIssueId == null || issue.Id != exceptIssueId)
                          select new { LineId = line.TransferOrderLineId!.Value, line.Quantity }).ToListAsync(ct);
        return rows.GroupBy(x => x.LineId).ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));
    }

    /// <summary>True when an issue that is not cancelled still carries out a line of the order.</summary>
    public static Task<bool> HasIssuesAsync(CoreContext db, long orderId, CancellationToken ct) =>
        (from line in db.TransferIssueLines.AsNoTracking()
         join issue in db.TransferIssues.AsNoTracking() on line.IssueId equals issue.Id
         join ol in db.TransferOrderLines.AsNoTracking() on line.TransferOrderLineId equals (long?)ol.Id
         where ol.OrderId == orderId && issue.Status != "Cancelled"
         select line.Id).AnyAsync(ct);

    public static async Task<Dictionary<long, decimal>> ReceivedByIssueLineAsync(CoreContext db, IReadOnlyCollection<long> issueLineIds,
        long? exceptReceiptId, CancellationToken ct)
    {
        if (issueLineIds.Count == 0) return [];
        var rows = await (from line in db.TransferReceiptLines.AsNoTracking()
                          join receipt in db.TransferReceipts.AsNoTracking() on line.ReceiptId equals receipt.Id
                          where line.TransferIssueLineId != null && issueLineIds.Contains(line.TransferIssueLineId.Value)
                                && receipt.Status != "Cancelled" && (exceptReceiptId == null || receipt.Id != exceptReceiptId)
                          select new { LineId = line.TransferIssueLineId!.Value, line.Quantity }).ToListAsync(ct);
        return rows.GroupBy(x => x.LineId).ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));
    }

    /// <summary>True when a receipt that is not cancelled still receives a line of the issue.</summary>
    public static Task<bool> HasReceiptsAsync(CoreContext db, long issueId, CancellationToken ct) =>
        (from line in db.TransferReceiptLines.AsNoTracking()
         join receipt in db.TransferReceipts.AsNoTracking() on line.ReceiptId equals receipt.Id
         join il in db.TransferIssueLines.AsNoTracking() on line.TransferIssueLineId equals (long?)il.Id
         where il.IssueId == issueId && receipt.Status != "Cancelled"
         select line.Id).AnyAsync(ct);
}
