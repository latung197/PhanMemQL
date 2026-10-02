using Core.Application.Modules.VoucherNumbering;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.VoucherNumbering;

/// <summary>
/// Settings › Tham số mặc định › Đánh số chứng từ (function sys_default_config). Numbers themselves are
/// taken by the voucher services (IVoucherNumberService.NextAsync) when a voucher is saved.
/// </summary>
[Route("api/settings/voucher-numbering")]
public sealed class VoucherNumberingController(IVoucherNumberService numbering) : ApiControllerBase
{
    private const string Function = "sys_default_config";

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public Task<IReadOnlyList<VoucherNumberingDto>> GetAll(CancellationToken ct) => numbering.GetAllAsync(CurrentUnitCode, ct);

    [HttpPut("{voucherType}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<VoucherNumberingDto> Update(string voucherType, SaveVoucherNumberingRequest request, CancellationToken ct) =>
        numbering.UpdateAsync(CurrentUserId, voucherType, request, CurrentUnitCode, ct);

    /// <summary>For voucher forms: the number a new voucher would get (?date=2026-09-30, default today).</summary>
    [HttpGet("{voucherType}/preview")]
    public async Task<IActionResult> Preview(string voucherType, [FromQuery] DateOnly? date, CancellationToken ct) =>
        Ok(new { number = await numbering.PreviewAsync(voucherType, CurrentUnitCode, date ?? DateOnly.FromDateTime(DateTime.Now), ct) });
}
