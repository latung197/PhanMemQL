using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

public sealed record UomTranslationDto(string LanguageCode, string Name);

public sealed record UomDto(string Code, string Name, string LocalizedName, string Symbol, string? Note,
    bool IsActive, RecordStampDto Stamp, uint Version, IReadOnlyList<UomTranslationDto> Translations);

public sealed record SaveUomRequest(string Code, string Name, string? Symbol, string? Note, bool IsActive = true,
    uint? Version = null, IReadOnlyList<UomTranslationDto>? Translations = null) : ICatalogRequest;

/// <summary>Everything a catalog service offers (list, export, create, update, delete, import) comes from ICatalogService.</summary>
public interface IUomService : ICatalogService<UomDto, SaveUomRequest>;
