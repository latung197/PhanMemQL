using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Departments;

/// <summary>UserCount = accounts (not deleted) in the department.</summary>
public sealed record DepartmentDto(string Code, string Name, string? Note, bool IsActive, int UserCount, RecordStampDto Stamp, uint Version);

public sealed record SaveDepartmentRequest(string Code, string Name, string? Note, bool IsActive = true, uint? Version = null) : ICatalogRequest;

/// <summary>
/// Everything a catalog service offers (paged list, export, create, update, delete, import) comes from ICatalogService.
/// Updating renames the department on its users; deleting is refused while users or approval rules use it.
/// </summary>
public interface IDepartmentService : ICatalogService<DepartmentDto, SaveDepartmentRequest>
{
    /// <summary>Every department (the settings backup).</summary>
    Task<IReadOnlyList<DepartmentDto>> GetAllAsync(CancellationToken ct);
}
