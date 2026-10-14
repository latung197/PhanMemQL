using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Modules.Users;

namespace Core.Infrastructure.Modules.Inventory;

/// <summary>
/// Changing or deleting a voucher that is already posted: the user needs the Edit (or Delete) action of the function and the right
/// ST_EDIT_POSTED of the voucher's company unit. The service then reverses the posting, makes the change and posts again in one
/// transaction, so the stock ledger refuses (and everything rolls back) when the stock would go negative.
/// </summary>
public static class PostedEdit
{
    public static async Task EnsureAsync(IPermissionService permissions, int userId, string function, string unitCode, bool forDelete, CancellationToken ct)
    {
        var actor = DocumentActor.For(await permissions.GetEffectiveAsync(userId, ct), await permissions.GetRightsAsync(userId, ct), function, true, unitCode);
        if (!(forDelete ? actor.Actions.Delete : actor.Actions.Edit)) throw new ForbiddenException(forDelete ? "policy.noDeleteRight" : "policy.noEditRight");
        if (!actor.Has(SpecialRightCatalog.StatusEditPosted)) throw new ForbiddenException("policy.editPostedRight");
    }
}
