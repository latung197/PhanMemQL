using Core.Application.Common.Exceptions;
using Core.Application.Modules.Users;
using Core.Application.Modules.VoucherStatuses;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.VoucherStatuses;

/// <summary>
/// Settings › Trạng thái chứng từ (function sys_voucher_status): per company unit, rename the statuses of each voucher type or switch
/// them off. The names the voucher screens show are open to every signed-in user (GET current).
/// </summary>
[Route("api/voucher-statuses")]
public sealed class VoucherStatusesController(IVoucherStatusService statuses, IPermissionService permissions) : ApiControllerBase
{
    private const string Function = "sys_voucher_status";

    /// <summary>The unit asked for (default: the one of the token); the user must work in it.</summary>
    private async Task<string> UnitAsync(string? unit, CancellationToken ct)
    {
        var code = string.IsNullOrWhiteSpace(unit) ? CurrentUnitCode : unit.Trim().ToUpperInvariant();
        if (code != CurrentUnitCode && !await permissions.HasUnitAccessAsync(CurrentUserId, code, ct))
            throw new ForbiddenException("auth.unitDenied");
        return code;
    }

    [HttpGet, RequirePermission(Function, PermissionAction.View)]
    public async Task<IReadOnlyList<VoucherStatusDto>> GetAll([FromQuery] string? unit, CancellationToken ct) =>
        await statuses.GetAllAsync(await UnitAsync(unit, ct), ct);

    [HttpPut("{voucherType}/{status}"), RequirePermission(Function, PermissionAction.Edit)]
    public async Task<VoucherStatusDto> Update(string voucherType, string status, [FromQuery] string? unit,
        SaveVoucherStatusRequest request, CancellationToken ct) =>
        await statuses.UpdateAsync(CurrentUserId, await UnitAsync(unit, ct), voucherType.ToUpperInvariant(), status, request, ct);

    /// <summary>Names and states of the statuses in the working unit, for the voucher screens (any signed-in user).</summary>
    [HttpGet("current")]
    public async Task<IReadOnlyDictionary<string, IReadOnlyDictionary<string, VoucherStatusNameDto>>> Current(CancellationToken ct) =>
        await statuses.GetNamesAsync(CurrentUnitCode, ct);
}
