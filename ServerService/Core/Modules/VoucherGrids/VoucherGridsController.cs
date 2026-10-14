using Core.Application.Modules.VoucherGrids;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.VoucherGrids;

/// <summary>
/// Settings › Cấu hình lưới chứng từ (function sys_voucher_grid): how the detail grids of the vouchers are shown, for the whole system.
/// The voucher screens read the configuration once after sign-in (GET, any signed-in user); only the administrators with the Edit
/// right change it.
/// </summary>
[Route("api/voucher-grids")]
public sealed class VoucherGridsController(IVoucherGridService grids) : ApiControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<VoucherGridDto>> GetAll(CancellationToken ct) => grids.GetAllAsync(ct);

    [HttpPut("{code}"), RequirePermission("sys_voucher_grid", PermissionAction.Edit)]
    public Task<VoucherGridDto> Update(string code, SaveVoucherGridRequest request, CancellationToken ct) =>
        grids.UpdateAsync(CurrentUserId, code, request, ct);
}
