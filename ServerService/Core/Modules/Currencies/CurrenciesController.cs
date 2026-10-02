using Core.Application.Modules.Currencies;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Currencies;

/// <summary>Settings › Ngoại tệ (function sys_currencies).</summary>
[Route("api/settings/currencies")]
public sealed class CurrenciesController(ICurrencyService currencies) : ApiControllerBase
{
    private const string Function = "sys_currencies";

    /// <summary>For every signed-in user: vouchers in a foreign currency pick from it.</summary>
    [HttpGet]
    public Task<IReadOnlyList<CurrencyDto>> GetAll(CancellationToken ct) => currencies.GetAllAsync(ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<CurrencyDto> Create(SaveCurrencyRequest request, CancellationToken ct) => currencies.CreateAsync(request, ct);

    [HttpPut("{code}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<CurrencyDto> Update(string code, SaveCurrencyRequest request, CancellationToken ct) =>
        currencies.UpdateAsync(code, request, ct);

    [HttpDelete("{code}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await currencies.DeleteAsync(code, ct);
        return NoContent();
    }
}
