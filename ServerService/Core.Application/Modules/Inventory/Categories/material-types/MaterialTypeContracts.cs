using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

public sealed record MaterialTypeDto(string Code, string Name, string? GroupName, string? Note, bool IsActive,
    RecordStampDto Stamp, uint Version);

public sealed record SaveMaterialTypeRequest(string Code, string Name, string? GroupName, string? Note, bool IsActive = true,
    uint? Version = null) : ICatalogRequest;

/// <summary>Everything a catalog service offers (list with the filter <c>group=</c>, export, create, update, delete, import) comes from ICatalogService.</summary>
public interface IMaterialTypeService : ICatalogService<MaterialTypeDto, SaveMaterialTypeRequest>;
