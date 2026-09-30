using System.ComponentModel.DataAnnotations;
using Core.Application.Security;

namespace Core.Application.Features.Erp.Auth;

public sealed record ErpLoginOptionsRequest([Required] string Username, [Required] string Password);
public sealed record ErpLoginRequest([Required] string Username, [Required] string Password,
    [Required] string UnitCode, string? PlantCode = null);
public sealed record ErpUnitOption(string UnitCode, string UnitName);
public sealed record ErpPlantOption(string UnitCode, string UnitName, string PlantCode, string PlantName);
public sealed record ErpLoginResult(int UserId, string UserName, string FullName, string UnitCode,
    string? PlantCode, string Token, bool IsAdmin, IReadOnlyList<PermissionGrantDto> Permissions);
public sealed record ErpActionPermissions(bool View, bool CreateEdit, bool Delete,
    bool Approve, bool PrintExport);
public sealed record ErpProfile(string Id, string Username, string FullName, string Email,
    string Role, string? RoleId, string Department, string Phone, string Avatar,
    string ThemePref, bool NotificationsEnabled, bool IsSystemAdmin,
    IReadOnlyDictionary<string, ErpActionPermissions> Permissions,
    string MaDvcs, IReadOnlyList<string> DsMaDvcs);

public interface IErpAuthService
{
    Task<IReadOnlyList<ErpPlantOption>> GetLoginOptionsAsync(ErpLoginOptionsRequest request, CancellationToken ct);
    Task<IReadOnlyList<ErpUnitOption>> GetUnitOptionsAsync(ErpLoginOptionsRequest request, CancellationToken ct);
    Task<ErpLoginResult> LoginAsync(ErpLoginRequest request, CancellationToken ct);
    Task<ErpProfile?> GetProfileAsync(int userId, string unitCode, CancellationToken ct);
    Task<bool> HasActiveContextAsync(int userId, string unitCode, string? plantCode, CancellationToken ct);
}
