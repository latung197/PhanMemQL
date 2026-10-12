namespace Core.Domain.Common;

/// <summary>
/// A voucher that goes through the approval workflow (goods receipts, goods issues...): the approval service reads who made it
/// and its value and moves its status as the approval steps are done. Statuses: Draft → Pending → Approved → Posted / Cancelled.
/// </summary>
public interface IApprovableDocument
{
    string Code { get; }
    string UnitCode { get; }
    string Status { get; set; }
    int? CreatedBy { get; }
    decimal TotalValue { get; }
    int? ApprovedByUserId { get; set; }
}
