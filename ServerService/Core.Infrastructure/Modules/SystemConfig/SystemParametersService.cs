using Core.Application.Modules.SystemConfig;

namespace Core.Infrastructure.Modules.SystemConfig;

/// <summary>Effective operating parameters of a unit (company-wide values overridden by the unit's own).</summary>
public sealed class SystemParametersService(ISystemConfigService config) : ISystemParameters
{
    public async Task<SystemParameters> GetAsync(string unitCode, CancellationToken ct) =>
        SystemParameters.From(await config.GetEffectiveAsync(unitCode, ct));
}
