namespace Core.Application.Modules.Departments;

/// <summary>UserCount = accounts (not deleted) in the department.</summary>
public sealed record DepartmentDto(string Code, string Name, string? Note, bool IsActive, int UserCount, uint Version);

public sealed record SaveDepartmentRequest(string Code, string Name, string? Note, bool IsActive = true, uint? Version = null);

public interface IDepartmentService
{
    Task<IReadOnlyList<DepartmentDto>> GetAllAsync(CancellationToken ct);
    Task<DepartmentDto> CreateAsync(SaveDepartmentRequest request, CancellationToken ct);

    /// <summary>The code is the key and cannot be changed; a new name is copied to the users.</summary>
    Task<DepartmentDto> UpdateAsync(string code, SaveDepartmentRequest request, CancellationToken ct);

    /// <summary>Refused while users or approval rules use the department (set it inactive instead).</summary>
    Task DeleteAsync(string code, CancellationToken ct);
}
