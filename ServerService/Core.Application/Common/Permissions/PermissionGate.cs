using Core.Application.Common.Exceptions;
using Core.Application.Modules.Users;

namespace Core.Application.Common.Permissions;

/// <summary>
/// First check of an action on a voucher (change of status, reject) before the voucher is looked up: someone with no access at all to the
/// function gets "permission.denied" whether or not the id exists, so ids cannot be probed (404 for a missing id, 403 for an existing one).
/// Access = "Xem" on the function or on one of its approval screens, or the "Duyệt" right of the function or its approval screens;
/// what the user may do with the voucher is still decided by DocumentStatusPolicy afterwards.
/// </summary>
public static class PermissionGate
{
    public static async Task EnsureTouchAsync(IPermissionService permissions, int userId, string function, CancellationToken ct)
    {
        var matrix = await permissions.GetEffectiveAsync(userId, ct);
        if (!PermissionMatrix.CanViewForApproval(matrix, function) && !PermissionMatrix.CanApprove(matrix, function))
            throw new ForbiddenException("permission.denied");
    }
}
