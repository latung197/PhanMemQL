namespace Core.Application.Security;

public sealed class PermissionGrantDto
{
    public string MenuId0 { get; set; } = string.Empty;
    public bool CanView { get; set; }
    public bool CanAdd { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
    public bool CanPrint { get; set; }
    public bool CanImport { get; set; }
    public bool CanExport { get; set; }
    public bool CanSearch { get; set; }
    public bool CanReload { get; set; }
    public bool CanCopy { get; set; }
    public bool CanApprove { get; set; }

    public bool Has(string action) => action.ToUpperInvariant() switch
    {
        "R" => CanView, "C" => CanAdd, "U" => CanEdit, "D" => CanDelete,
        "P" => CanPrint, "I" => CanImport, "E" => CanExport, "S" => CanSearch,
        "L" => CanReload, "Y" => CanCopy, "A" => CanApprove, _ => false
    };

    public void Add(PermissionGrantDto other)
    {
        CanView |= other.CanView;
        CanAdd |= other.CanAdd;
        CanEdit |= other.CanEdit;
        CanDelete |= other.CanDelete;
        CanPrint |= other.CanPrint;
        CanImport |= other.CanImport;
        CanExport |= other.CanExport;
        CanSearch |= other.CanSearch;
        CanReload |= other.CanReload;
        CanCopy |= other.CanCopy;
        CanApprove |= other.CanApprove;
    }
}

public sealed class SaveRoleRequest
{
    public int RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public List<PermissionGrantDto> Permissions { get; set; } = [];
}

public sealed class SetUserRolesRequest
{
    public List<int> RoleIds { get; set; } = [];
}

public sealed class SetUserPermissionsRequest
{
    public List<PermissionGrantDto> Permissions { get; set; } = [];
}

public sealed class UserAccessDto
{
    public bool IsAdmin { get; set; }
    public List<int> RoleIds { get; set; } = [];
    public List<PermissionGrantDto> IndividualPermissions { get; set; } = [];
    public List<PermissionGrantDto> EffectivePermissions { get; set; } = [];
}

public sealed record CommandDto(string MenuId0, string Text, string Type);
public sealed record RoleDto(int RoleId, string RoleName, string? Description, bool IsActive,
    IReadOnlyList<PermissionGrantDto> Permissions);
