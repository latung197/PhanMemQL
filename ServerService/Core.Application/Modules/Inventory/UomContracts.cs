using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

public sealed record UomDto(string Code, string Name, string Symbol, string? Note, bool IsActive, RecordStampDto Stamp);

public sealed record SaveUomRequest(string Code, string Name, string? Symbol, string? Note, bool IsActive = true);

public interface IUomService
{
    Task<IReadOnlyList<UomDto>> GetAllAsync(CancellationToken ct);
    Task<UomDto> CreateAsync(SaveUomRequest request, CancellationToken ct);

    /// <summary>The code is the key and cannot be changed.</summary>
    Task<UomDto> UpdateAsync(string code, SaveUomRequest request, CancellationToken ct);

    /// <summary>Refused while other data uses the unit (set it inactive instead).</summary>
    Task DeleteAsync(string code, CancellationToken ct);
}
