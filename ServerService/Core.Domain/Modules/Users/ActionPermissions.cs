namespace Core.Domain.Modules.Users;

/// <summary>Actions of Frontend ActionPermissions, used to protect API endpoints.</summary>
public enum PermissionAction
{
    View,
    CreateEdit,
    Delete,
    Approve,
    PrintExport
}

/// <summary>
/// The five actions the frontend grants per function (Frontend/src/types/index.ts ActionPermissions).
/// </summary>
public sealed record ActionPermissions(bool View, bool CreateEdit, bool Delete, bool Approve, bool PrintExport)
{
    public static ActionPermissions Full { get; } = new(true, true, true, true, true);
    public static ActionPermissions None { get; } = new(false, false, false, false, false);

    public bool HasAny() => View || CreateEdit || Delete || Approve || PrintExport;

    public bool Allows(PermissionAction action) => action switch
    {
        PermissionAction.View => View,
        PermissionAction.CreateEdit => CreateEdit,
        PermissionAction.Delete => Delete,
        PermissionAction.Approve => Approve,
        PermissionAction.PrintExport => PrintExport,
        _ => false
    };
}
