using Core.Application.Common.Auditing;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Users;

/// <summary>
/// Change log of accounts (function sys_users, object "user") beyond the automatic entries of SysUser: what an account
/// really has before and after a permission change (role, effective matrix, special rights), so the log shows the rights
/// gained or lost whatever stored rows changed, and actions without fields (password reset / change).
/// </summary>
public sealed class UserAccessAudit(CoreContext db, IPermissionService permissions, IAuditLog auditLog)
{
    public const string Function = "sys_users";
    public const string ObjectType = "user";

    public sealed record Snapshot(string? Role, IReadOnlyDictionary<string, ActionPermissions> Matrix,
        IReadOnlySet<string> Rights);

    /// <summary>Reads the user's access from the database (call again after SaveChanges for the new state).</summary>
    public async Task<Snapshot> SnapshotAsync(int userId, CancellationToken ct)
    {
        permissions.Forget(userId);
        var roles = await db.UserRoles.AsNoTracking().ActiveRoles().Where(x => x.UserId == userId)
            .Select(x => x.Role.RoleName).OrderBy(x => x).ToListAsync(ct);
        return new Snapshot(roles.Count == 0 ? null : string.Join(", ", roles),
            await permissions.GetEffectiveAsync(userId, ct), await permissions.GetRightsAsync(userId, ct));
    }

    /// <summary>
    /// Logs the access changes of one account, nothing when it did not change. Action PERMISSIONS for an edit on the
    /// screen, SYNC (note = role name) when the account was reset to its role.
    /// </summary>
    public Task RecordAsync(SysUser user, Snapshot before, Snapshot after, string action, string? note, CancellationToken ct)
    {
        var diff = new AuditDiff().Field("role", before.Role, after.Role)
            .Matrix(before.Matrix, after.Matrix).Rights(before.Rights, after.Rights);
        return diff.IsEmpty ? Task.CompletedTask : auditLog.RecordAsync(
            new AuditEntry(Function, ObjectType, user.UserId.ToString(), Label(user), action, diff.Changes, note), ct);
    }

    /// <summary>The role of a new account, shown in its automatic CREATE entry.</summary>
    public void AttachRole(SysUser user, string? role) =>
        auditLog.Attach(user, [new AuditChange("role", null, role)]);

    /// <summary>An action on the account without changed fields (password reset, password change).</summary>
    public Task RecordActionAsync(SysUser user, string action, CancellationToken ct) =>
        auditLog.RecordAsync(new AuditEntry(Function, ObjectType, user.UserId.ToString(), Label(user), action, []), ct);

    public static string Label(SysUser user) => $"{user.FullName} (@{user.UserName})";
}
