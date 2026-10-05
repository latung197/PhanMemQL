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
    bool IsActive = true, uint? Version = null) : ICatalogRequest;

public interface IUomConversionService : ICatalogService<UomConversionDto, SaveUomConversionRequest>;
