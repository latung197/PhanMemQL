using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

public sealed record UomConversionDto(
    string Code, string? MaterialCode, string? MaterialName,
    string FromUomCode, string FromUomName, string ToUomCode, string ToUomName,
    decimal Factor, string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

public sealed record SaveUomConversionRequest(
    string Code, string? MaterialCode, string? MaterialName,
    string FromUomCode, string ToUomCode, decimal Factor, string? Note,
    bool IsActive = true, uint? Version = null);

public interface IUomConversionService
{
    Task<IReadOnlyList<UomConversionDto>> GetAllAsync(CancellationToken ct);
    Task<UomConversionDto> CreateAsync(SaveUomConversionRequest request, CancellationToken ct);
    Task<UomConversionDto> UpdateAsync(string code, SaveUomConversionRequest request, CancellationToken ct);
    Task DeleteAsync(string code, CancellationToken ct);
    Task<ImportResult> ImportAsync(ImportRequest<SaveUomConversionRequest> request, CancellationToken ct);
    Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, CancellationToken ct);
}
