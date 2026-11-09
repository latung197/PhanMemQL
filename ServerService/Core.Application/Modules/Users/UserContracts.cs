using System.Text.Json.Serialization;
using Core.Domain.Modules.Users;

namespace Core.Application.Modules.Users;

/// <summary>
/// Same shape as Frontend UserProfile (src/types/index.ts). Department is the department name for
/// display, DepartmentCode its code (sys_department).
/// </summary>
public sealed record UserProfileDto(
    string Id,
    string Username,
    string FullName,
    string Email,
    string Role,
    string? RoleId,
    string Department,
    string? DepartmentCode,
    string Phone,
    string Avatar,
    string ThemePref,
    bool NotificationsEnabled,
    bool IsSystemAdmin,
    IReadOnlyDictionary<string, ActionPermissions> Permissions,
    [property: JsonPropertyName("ma_dvcs")] string MaDvcs,
    [property: JsonPropertyName("ds_ma_dvcs")] IReadOnlyList<string> DsMaDvcs,
    string EmployeeCode,
    bool IsActive,
    /// <summary>Granted special rights as "{function}:{code}" (SpecialRightCatalog).</summary>
    IReadOnlyList<string> SpecialRights,
    /// <summary>Language the user works in: their own choice when it is active, otherwise the default language.</summary>
    string Language,
    /// <summary>The user's own choice (null = follow the default language of the company).</summary>
    string? LanguagePreference,
    /// <summary>Row version, sent back by UpdateUserRequest / SetUserPermissionsRequest (IVersioned).</summary>
    uint Version,
    /// <summary>The role of the user in each unit they may work in (RoleId null = the default role).</summary>
    IReadOnlyList<UserUnitRoleDto>? UnitRoles = null);

/// <summary>The role a user holds in one company unit; null RoleId = their default role.</summary>
public sealed record UserUnitRoleDto(string UnitCode, string? RoleId, string? RoleName);

public sealed record CreateUserRequest(
    string Username,
    string Password,
    string FullName,
    string? Email,
    string? Phone,
    string? DepartmentCode,
    string? Avatar,
    string? EmployeeCode,
    string? RoleId,
    [property: JsonPropertyName("ma_dvcs")] string MaDvcs,
    [property: JsonPropertyName("ds_ma_dvcs")] IReadOnlyList<string>? DsMaDvcs,
    IReadOnlyDictionary<string, ActionPermissions>? Permissions);

public sealed record UpdateUserRequest(
    string FullName,
    string? Email,
    string? Phone,
    string? DepartmentCode,
    string? Avatar,
    string? ThemePref,
    bool NotificationsEnabled,
    string? EmployeeCode,
    bool IsActive,
    [property: JsonPropertyName("ma_dvcs")] string MaDvcs,
    [property: JsonPropertyName("ds_ma_dvcs")] IReadOnlyList<string>? DsMaDvcs,
    uint? Version = null);

/// <summary>Assigns a role (null = none) and stores the user's own permission matrix and special rights.</summary>
/// <param name="UnitRoles">Role of the user in each unit (unit code → role id; null or empty = the default role in that unit). Null keeps
/// the unit roles the user has. A unit role replaces the default role in that unit; the user's own exceptions apply in every unit.</param>
public sealed record SetUserPermissionsRequest(string? RoleId,
    IReadOnlyDictionary<string, ActionPermissions> Permissions,
    IReadOnlyList<string>? SpecialRights = null, uint? Version = null,
    IReadOnlyDictionary<string, string?>? UnitRoles = null);

public sealed record ResetPasswordRequest(string NewPassword);

public interface IUserService
{
    /// <summary>Administrators get every account, others only the accounts sharing a company unit with them.</summary>
    Task<IReadOnlyList<UserProfileDto>> GetAllAsync(int actorUserId, CancellationToken ct);

    /// <summary>Profile as seen after signing in to <paramref name="unitCode"/>.</summary>
    Task<UserProfileDto> GetProfileAsync(int userId, string unitCode, CancellationToken ct);

    // actorUserId: only administrators may grant the ADMIN role or change an administrator account.
    Task<UserProfileDto> CreateAsync(int actorUserId, CreateUserRequest request, CancellationToken ct);
    Task<UserProfileDto> UpdateAsync(int actorUserId, int userId, UpdateUserRequest request, CancellationToken ct);
    Task<UserProfileDto> SetPermissionsAsync(int actorUserId, int userId, SetUserPermissionsRequest request,
        CancellationToken ct);
    Task ResetPasswordAsync(int actorUserId, int userId, ResetPasswordRequest request, CancellationToken ct);
    Task DeleteAsync(int actorUserId, int userId, CancellationToken ct);
}

/// <summary>Permission checks used by authorization and by the other modules.</summary>
public interface IPermissionService
{
    Task<bool> IsAdminAsync(int userId, CancellationToken ct = default);
    Task<bool> IsTokenCurrentAsync(int userId, int securityVersion, CancellationToken ct = default);
    /// <summary>The unit exists, is active, and the user is an administrator or was given it.</summary>
    Task<bool> HasUnitAccessAsync(int userId, string unitCode, CancellationToken ct = default);
    /// <summary>The company units whose data the user may see in system-wide screens (change log...): null for an administrator (every
    /// unit), otherwise the units given to the user.</summary>
    Task<IReadOnlySet<string>?> VisibleUnitsAsync(int userId, CancellationToken ct = default);

    /// <summary>
    /// One entry per catalog function; admins get full rights everywhere. Rights depend on the company unit (the user may hold a
    /// different role in each unit): for the signed-in user of the request this is the unit of the session, for anyone else the
    /// default role. Use <see cref="GetEffectiveInUnitAsync"/> to read another user's rights in a given unit.
    /// </summary>
    Task<IReadOnlyDictionary<string, ActionPermissions>> GetEffectiveAsync(int userId, CancellationToken ct = default);

    /// <summary>The rights of a user in one company unit: the role of that unit (or the default role) plus the user's own exceptions.
    /// Null unit = the default role.</summary>
    Task<IReadOnlyDictionary<string, ActionPermissions>> GetEffectiveInUnitAsync(int userId, string? unitCode, CancellationToken ct = default);

    /// <summary>
    /// The rights of many users in one company unit with a fixed number of queries (e.g. finding the approvers of a voucher of that
    /// unit). Only active users are returned.
    /// </summary>
    Task<IReadOnlyDictionary<int, IReadOnlyDictionary<string, ActionPermissions>>> GetEffectiveManyAsync(
        IReadOnlyCollection<int> userIds, string? unitCode, CancellationToken ct = default);

    /// <summary>Special rights as "{function}:{code}"; admins have all of them. Same unit rule as <see cref="GetEffectiveAsync"/>.</summary>
    Task<IReadOnlySet<string>> GetRightsAsync(int userId, CancellationToken ct = default);

    /// <summary>Special rights of a user in one company unit (null unit = the default role).</summary>
    Task<IReadOnlySet<string>> GetRightsInUnitAsync(int userId, string? unitCode, CancellationToken ct = default);

    Task<bool> HasRightAsync(int userId, string function, string rightCode, CancellationToken ct = default);

    /// <summary>Throws ForbiddenException when the user may not perform the action on the function.</summary>
    Task EnsureAllowedAsync(int userId, string function, PermissionAction action, CancellationToken ct = default);
    /// <summary>Allowed when the user has at least one of the actions.</summary>
    Task EnsureAnyAllowedAsync(int userId, string function, IReadOnlyCollection<PermissionAction> actions,
        CancellationToken ct = default);

    /// <summary>Throws ForbiddenException when the user is not an administrator.</summary>
    Task EnsureAdminAsync(int userId, CancellationToken ct = default);

    /// <summary>Drops the request cache of a user, e.g. to read their rights again after changing them.</summary>
    void Forget(int userId);
}
