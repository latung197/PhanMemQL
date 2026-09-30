using Core.Domain.Modules.Users;

namespace Core.Application.Modules.Roles;

/// <summary>Same shape as Frontend RoleDefinition.</summary>
public sealed record RoleDto(string Id, string Code, string Name, string Description,
    bool IsSystemRole, IReadOnlyDictionary<string, ActionPermissions> Permissions, IReadOnlyList<string> SpecialRights);

public sealed record SaveRoleRequest(string Code, string Name, string? Description,
    IReadOnlyDictionary<string, ActionPermissions>? Permissions, IReadOnlyList<string>? SpecialRights = null);

public interface IRoleService
{
    Task<IReadOnlyList<RoleDto>> GetAllAsync(CancellationToken ct);
    // Only administrators may create or change the ADMIN role.
    Task<RoleDto> CreateAsync(int actorUserId, SaveRoleRequest request, CancellationToken ct);
    Task<RoleDto> UpdateAsync(int actorUserId, int roleId, SaveRoleRequest request, CancellationToken ct);

    /// <summary>Copies the role matrix to every user holding the role; returns the user count.</summary>
    Task<int> SyncUsersAsync(int roleId, CancellationToken ct);

    /// <summary>
    /// Deletes the role and its permissions. Refused for the ADMIN role, for a role still assigned to an
    /// account (active or locked) and for a role used by an approval rule.
    /// </summary>
    Task DeleteAsync(int actorUserId, int roleId, CancellationToken ct);
}
