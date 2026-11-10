using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.{{PhanHe}}.Categories;

/// <summary>{{tenVi}} ({{ma}}).</summary>
public sealed record {{Ten}}Dto(string Code, string Name, string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

public sealed record Save{{Ten}}Request(string Code, string Name, string? Note = null, bool IsActive = true, uint? Version = null) : ICatalogRequest;

public interface I{{Ten}}Service : ICatalogService<{{Ten}}Dto, Save{{Ten}}Request>;
