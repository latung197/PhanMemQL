using Core.Application.Common.Export;
using Core.Application.Common.Paging;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Purchasing.Documents.PurchaseInvoices;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Purchasing.Documents.PurchaseInvoices;

[Route("api/purchasing/purchase-invoices")]
public sealed class PurchaseInvoicesController(IPurchaseInvoiceService invoices) : ApiControllerBase
{
    private const string Function = "pur_invoice";

    /// <summary>One page: ?page=1&amp;pageSize=20&amp;sort=dueDate&amp;dir=asc&amp;search=...&amp;status=Approved&amp;supplier=NCC001&amp;from=2026-10-01.</summary>
    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<PagedResult<PurchaseInvoiceDto>> GetAll([FromQuery] VoucherListQuery query, CancellationToken ct) =>
        invoices.ListAsync(CurrentUserId, CurrentUnitCode, query, ct);

    /// <summary>The same list (same filters, without the page) as an Excel file.</summary>
    [HttpGet("export"), RequirePermission(Function, PermissionAction.View), RequirePermission(Function, PermissionAction.Export)]
    public async Task<IActionResult> Export([FromQuery] VoucherListQuery query, CancellationToken ct)
    {
        var file = await invoices.ExportAsync(CurrentUserId, CurrentUnitCode, query, ct);
        return File(file.Content, ExportFile.ContentType, file.FileName);
    }

    [HttpGet("options"), RequirePermission(Function, PermissionAction.View)]
    public Task<PurchaseInvoiceOptionsDto> Options(CancellationToken ct) => invoices.GetOptionsAsync(ct);

    /// <summary>Approved / posted goods receipts of a supplier with something left to bill: what "Lấy từ phiếu nhập kho" lists (needs the invoice View right).</summary>
    [HttpGet("open-receipts"), RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<OpenInvoiceReceiptDto>> OpenReceipts([FromQuery] string? supplier, [FromQuery] long? invoiceId, CancellationToken ct) =>
        invoices.GetOpenReceiptsAsync(CurrentUserId, CurrentUnitCode, supplier, invoiceId, ct);

    /// <summary>Approved orders of a supplier with something left to bill: what "Lấy từ đơn mua hàng" lists (needs the invoice View right).</summary>
    [HttpGet("open-orders"), RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<OpenInvoiceOrderDto>> OpenOrders([FromQuery] string? supplier, [FromQuery] long? invoiceId, CancellationToken ct) =>
        invoices.GetOpenOrdersAsync(CurrentUserId, CurrentUnitCode, supplier, invoiceId, ct);

    [HttpGet("{id:long}"), RequirePermission(Function, PermissionAction.View)]
    public Task<PurchaseInvoiceDto> Get(long id, CancellationToken ct) =>
        invoices.GetAsync(CurrentUserId, CurrentUnitCode, id, ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<PurchaseInvoiceDto> Create(SavePurchaseInvoiceRequest request, CancellationToken ct) =>
        invoices.CreateAsync(CurrentUserId, CurrentUnitCode, request, ct);

    [HttpPut("{id:long}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<PurchaseInvoiceDto> Update(long id, SavePurchaseInvoiceRequest request, CancellationToken ct) =>
        invoices.UpdateAsync(CurrentUserId, CurrentUnitCode, id, request, ct);

    // The segment is called "operation": "action" is a reserved route parameter name in ASP.NET Core and never matches.
    [HttpPost("{id:long}/{operation}")]
    public Task<PurchaseInvoiceDto> ChangeStatus(long id, string operation, CancellationToken ct) =>
        invoices.ChangeStatusAsync(CurrentUserId, CurrentUnitCode, id, operation, ct);

    [HttpPost("{id:long}/reject")]
    public Task<PurchaseInvoiceDto> Reject(long id, ApprovalActionRequest request, CancellationToken ct) =>
        invoices.RejectAsync(CurrentUserId, CurrentUnitCode, id, request.Note ?? string.Empty, ct);

    [HttpDelete("{id:long}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await invoices.DeleteAsync(CurrentUserId, CurrentUnitCode, id, ct);
        return NoContent();
    }
}
