namespace Core.Application.Security;

public interface IAccessControlService
{
    Task<bool> IsActiveAsync(int userId, CancellationToken cancellationToken = default);
    Task<bool> IsTokenCurrentAsync(int userId, int securityVersion, CancellationToken cancellationToken = default);
    Task<bool> IsAdminAsync(int userId, CancellationToken cancellationToken = default);
    Task<bool> HasPermissionAsync(int userId, string menuId0, string action, CancellationToken cancellationToken = default);
    Task<UserAccessDto> GetUserAccessAsync(int userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CommandDto>> GetCommandsAsync(CancellationToken cancellationToken = default);
    Task SeedApiFunctionsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken cancellationToken = default);
    Task<int> SaveRoleAsync(SaveRoleRequest request, CancellationToken cancellationToken = default);
    Task SetUserRolesAsync(int userId, IReadOnlyCollection<int> roleIds, CancellationToken cancellationToken = default);
    Task SetUserPermissionsAsync(int userId, IReadOnlyCollection<PermissionGrantDto> permissions, CancellationToken cancellationToken = default);
}
