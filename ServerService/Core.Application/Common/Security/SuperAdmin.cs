namespace Core.Application.Common.Security;

/// <summary>
/// The one account allowed to change the menu structure (names, icons, order, groups), configured as
/// Security:SuperAdmin (default "admin"). It must also hold the ADMIN role, so a leftover account of the same
/// name without it gets nothing.
/// </summary>
public interface ISuperAdmin
{
    bool IsSuperAdminName(string? userName);
}
