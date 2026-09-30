namespace Core.Application.Features.Erp.Users;

public sealed record UserDto(int Id, string Username, string FullName, string Email,
    string Phone, string Department, string Avatar, string ThemePref,
    bool NotificationsEnabled, string DefaultUnitCode, string EmployeeCode,
    bool IsActive);

public sealed record CreateUserRequest(string Username, string Password, string FullName,
    string? Email, string? Phone, string? Department, string? Avatar,
    string? ThemePref, bool NotificationsEnabled, string DefaultUnitCode,
    string EmployeeCode);

public sealed record UpdateUserRequest(string FullName, string? Email, string? Phone,
    string? Department, string? Avatar, string? ThemePref,
    bool NotificationsEnabled, string DefaultUnitCode, string EmployeeCode,
    bool IsActive);

public sealed record ChangeOwnPasswordRequest(string CurrentPassword, string NewPassword);

public sealed record UserPage(IReadOnlyList<UserDto> Items, int Total, int Page, int PageSize);

public interface IUserManagementService
{
    Task<UserPage> SearchAsync(string? search, int page, int pageSize, CancellationToken ct);
    Task<UserDto?> GetAsync(int userId, CancellationToken ct);
    Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct);
    Task<UserDto?> UpdateAsync(int userId, UpdateUserRequest request, CancellationToken ct);
    Task<bool> DeleteAsync(int userId, int actorUserId, CancellationToken ct);
    Task ChangeOwnPasswordAsync(int userId, ChangeOwnPasswordRequest request, CancellationToken ct);
}
