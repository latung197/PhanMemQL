using Core.Application.Modules.Fiscal;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Fiscal;

/// <summary>
/// Settings › Năm tài chính & khóa sổ (function sys_fiscal_year). Locks apply to the company unit of the
/// session; to lock another unit, switch to it.
/// </summary>
[Route("api/settings/fiscal-periods")]
public sealed class FiscalPeriodsController(IFiscalPeriodService periods) : ApiControllerBase
{
    private const string Function = "sys_fiscal_year";

    /// <summary>For every signed-in user: voucher screens warn about locked months.</summary>
    [HttpGet("{year:int}")]
    public Task<IReadOnlyList<FiscalMonthDto>> GetYear(int year, CancellationToken ct) =>
        periods.GetYearAsync(CurrentUnitCode, year, ct);

    [HttpPut("{year:int}"), RequirePermission(Function, PermissionAction.CreateEdit)]
    public Task<IReadOnlyList<FiscalMonthDto>> SetLock(int year, SetFiscalLockRequest request, CancellationToken ct) =>
        periods.SetLockAsync(CurrentUserId, CurrentUnitCode, year, request, ct);

    /// <summary>Whether a voucher dated ?date=2026-09-30 may be created in the session's unit.</summary>
    [HttpGet("check")]
    public Task<DateLockCheck> Check([FromQuery] DateOnly date, CancellationToken ct) =>
        periods.CheckDateAsync(CurrentUnitCode, date, ct);
}
