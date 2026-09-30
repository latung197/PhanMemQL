using Core.Application.Features.Erp.Auth;
using Core.Features.Erp;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace Core.Features.Erp.Auth;

[ApiController]
[Route("api/erp/auth")]
public sealed class ErpAuthController(IErpAuthService auth) : ControllerBase
{
    [HttpPost("login-options")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> LoginOptions(ErpLoginOptionsRequest request, CancellationToken ct)
    {
        try { return Ok(await auth.GetLoginOptionsAsync(request, ct)); }
        catch (UnauthorizedAccessException) { return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu không đúng." }); }
    }

    [HttpPost("unit-options")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> UnitOptions(ErpLoginOptionsRequest request, CancellationToken ct)
    {
        try { return Ok(await auth.GetUnitOptionsAsync(request, ct)); }
        catch (UnauthorizedAccessException) { return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu không đúng." }); }
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login(ErpLoginRequest request, CancellationToken ct)
    {
        try { return Ok(await auth.LoginAsync(request, ct)); }
        catch (UnauthorizedAccessException) { return Unauthorized(new { message = "Thông tin đăng nhập hoặc đơn vị cơ sở không hợp lệ." }); }
    }

    [HttpGet("context")]
    [Authorize(Policy = "ErpContext")]
    public IActionResult Context() => ErpClaims.TryGet(User, out var userId, out var unitCode, out var plantCode)
        ? Ok(new { userId, unitCode, plantCode }) : Unauthorized();

    [HttpGet("me")]
    [Authorize(Policy = "ErpContext")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        if (!ErpClaims.TryGet(User, out var userId, out var unitCode, out _)) return Unauthorized();
        var profile = await auth.GetProfileAsync(userId, unitCode, ct);
        return profile is null ? NotFound() : Ok(profile);
    }
}
