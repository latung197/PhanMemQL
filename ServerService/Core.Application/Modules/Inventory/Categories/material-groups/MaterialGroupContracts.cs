using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Inventory;

public sealed record MaterialGroupDto(string Code, string Name, string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

public sealed record SaveMaterialGroupRequest(string Code, string Name, string? Note, bool IsActive = true, uint? Version = null)
    : ICatalogRequest;

/// <summary>Everything a catalog service offers (list, export, create, update, delete, import) comes from ICatalogService.</summary>
public interface IMaterialGroupService : ICatalogService<MaterialGroupDto, SaveMaterialGroupRequest>;
