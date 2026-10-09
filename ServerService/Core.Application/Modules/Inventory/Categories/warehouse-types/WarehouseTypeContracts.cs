using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

public sealed record WarehouseTypeTranslationDto(string LanguageCode, string Name);

public sealed record WarehouseTypeDto(string Code, string Name, string LocalizedName, string? Note, bool IsActive,
    RecordStampDto Stamp, uint Version, IReadOnlyList<WarehouseTypeTranslationDto> Translations);

public sealed record SaveWarehouseTypeRequest(string Code, string Name, string? Note, bool IsActive = true,
    uint? Version = null, IReadOnlyList<WarehouseTypeTranslationDto>? Translations = null) : ICatalogRequest;

/// <summary>Everything a catalog service offers (list, export, create, update, delete, import) comes from ICatalogService.</summary>
public interface IWarehouseTypeService : ICatalogService<WarehouseTypeDto, SaveWarehouseTypeRequest>;
