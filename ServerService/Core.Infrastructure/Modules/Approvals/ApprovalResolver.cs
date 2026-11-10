using Core.Application.Common.Localization;
using Core.Application.Common.Permissions;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Users;
using Core.Application.Modules.VoucherStatuses;
using Core.Domain.Modules.Approvals;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Modules.Users;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Approvals;

/// <summary>
/// Approvers of one approval level, already expanded to user ids: the people notified when the voucher reaches that level.
/// <paramref name="TargetStatus"/> is the voucher status the level takes it to (Approved1, Approved2 or Approved).
/// </summary>
public sealed record ResolvedApprovalLevel(int Level, string Label, IReadOnlyList<int> UserIds, DocumentStatus TargetStatus = DocumentStatus.Approved);

public sealed record ApprovalResolution(bool UsesDefaultApprovers, IReadOnlyList<ResolvedApprovalLevel> Levels);

/// <summary>
/// The approval levels of a document and the people notified at each. The levels are the approval statuses the company unit uses for
/// the voucher (Settings › Trạng thái chứng từ: Duyệt cấp 1, Duyệt cấp 2 when switched on, then Đã duyệt), level k = the k-th of them.
/// The rules of level k name whom to notify; without a rule for a level, the users whose status rights stop at that level are (those
/// who may approve it but not the next one), or else everyone who may approve it. A notified user must be active, allowed in the unit,
/// reach the level's status there (DocumentStatusPolicy: whoever approves needs it) and not be the requester (who, holding the right,
/// approves without being asked). Rules of a level the unit does not use are ignored.
/// </summary>
public sealed class ApprovalResolver(CoreContext db, IPermissionService permissions, IVoucherStatusService statuses)
{
    /// <param name="includeRequester">True keeps the requester among the approvers (a user who saves a voucher straight at the
    /// approved status); the normal workflow never lets someone approve their own voucher.</param>
    public async Task<ApprovalResolution> ResolveAsync(string function, string unitCode, int requesterUserId,
        decimal? amount, CancellationToken ct, bool includeRequester = false)
    {
        var requester = await RequesterAsync(requesterUserId, unitCode, ct);
        var rules = await db.ApprovalRules.AsNoTracking().Where(x => x.MenuId0 == function && x.IsActive).ToListAsync(ct);
        var steps = await statuses.ApprovalLevelsAsync(unitCode, function, ct);
        if (steps.Count == 0) steps = [DocumentStatus.Approved];
        var byLevel = ApprovalRuleEngine.Resolve(rules, function, unitCode, requester, amount).ToDictionary(x => x.Level);
        var roleNames = await db.Roles.AsNoTracking().ToDictionaryAsync(x => x.RoleId.ToString(), x => x.RoleName, ct);
        var userNames = await db.Users.AsNoTracking().NotDeleted().ToDictionaryAsync(x => x.UserId.ToString(), x => x.FullName, ct);
        var everyone = await db.Users.AsNoTracking().ActiveUsers().Select(x => x.UserId).ToListAsync(ct);

        var result = new List<ResolvedApprovalLevel>();
        for (var index = 0; index < steps.Count; index++)
        {
            var level = index + 1;
            var status = steps[index];
            if (!byLevel.TryGetValue(level, out var rule))
            {
                // No rule: the users whose rights stop at this level; else anyone who may approve it.
                var next = index + 1 < steps.Count ? steps[index + 1] : (DocumentStatus?)null;
                var reach = await ReachAsync(everyone, function, unitCode, requesterUserId, includeRequester, status, ct);
                var own = next is null ? reach : reach.Except(await ReachAsync(reach, function, unitCode, requesterUserId, includeRequester, next.Value, ct)).ToList();
                result.Add(new ResolvedApprovalLevel(level, Messages.T("approval.defaultApprovers"), own.Count > 0 ? own : reach, status));
                continue;
            }
            var candidates = new List<int>();
            foreach (var approver in rule.Approvers)
            {
                if (approver.Type == ApproverTypes.User && int.TryParse(approver.Value, out var userId)) candidates.Add(userId);
                else if (approver.Type == ApproverTypes.Role && int.TryParse(approver.Value, out var roleId))
                {
                    // Holders of the role in this unit: its unit role there, or their default role when they have no unit role there.
                    candidates.AddRange(await db.UserRoles.ActiveRoles().Where(x => x.RoleId == roleId
                        && !db.UserCompanyUnits.Any(u => u.UserId == x.UserId && u.UnitCode == unitCode && u.RoleId != null)).Select(x => x.UserId).ToListAsync(ct));
                    candidates.AddRange(await db.UserCompanyUnits.AsNoTracking().Where(x => x.UnitCode == unitCode && x.RoleId == roleId)
                        .Select(x => x.UserId).ToListAsync(ct));
                }
            }
            var label = string.Join(", ", rule.Approvers.Select(a => a.Type == ApproverTypes.Role
                ? Messages.T("approval.roleLabel", roleNames.GetValueOrDefault(a.Value, a.Value))
                : userNames.GetValueOrDefault(a.Value, $"#{a.Value}")));
            result.Add(new ResolvedApprovalLevel(level, label,
                await ReachAsync(candidates.Distinct(), function, unitCode, requesterUserId, includeRequester, status, ct), status));
        }
        return new ApprovalResolution(byLevel.Count == 0, result);
    }

    /// <summary>The requester of a voucher of the unit: their department and the role they hold in that unit (unit role, else default role).</summary>
    public async Task<ApprovalRequester> RequesterAsync(int userId, string unitCode, CancellationToken ct)
    {
        var department = await db.Users.AsNoTracking().Where(x => x.UserId == userId).Select(x => x.DepartmentCode).FirstOrDefaultAsync(ct);
        var unitRole = await db.UserCompanyUnits.AsNoTracking().Where(x => x.UserId == userId && x.UnitCode == unitCode && x.RoleId != null)
            .Select(x => x.RoleId).FirstOrDefaultAsync(ct);
        var roleIds = unitRole is int role ? [role]
            : await db.UserRoles.AsNoTracking().ActiveRoles().Where(x => x.UserId == userId).Select(x => x.RoleId).ToListAsync(ct);
        return new ApprovalRequester(userId, roleIds, department);
    }

    /// <summary>The candidates who may work in the unit and reach <paramref name="status"/> of the function there.</summary>
    private async Task<List<int>> ReachAsync(IEnumerable<int> candidates, string function, string unitCode, int requesterUserId,
        bool includeRequester, DocumentStatus status, CancellationToken ct)
    {
        var ids = candidates.Where(id => includeRequester || id != requesterUserId).Distinct().ToList();
        // Rights of every candidate at once (only active users come back), not a few queries per candidate.
        // Rights in the unit of the voucher (a user may hold another role there).
        var matrices = await permissions.GetEffectiveManyAsync(ids, unitCode, ct);
        var inUnit = (await db.UserCompanyUnits.AsNoTracking().Where(x => ids.Contains(x.UserId) && x.UnitCode == unitCode)
            .Select(x => x.UserId).ToListAsync(ct)).ToHashSet();
        var result = new List<int>();
        foreach (var (id, matrix) in matrices)
        {
            // Administrators may work in every unit (cached by GetEffectiveManyAsync, no query).
            if (!inUnit.Contains(id) && !await permissions.IsAdminAsync(id, ct)) continue;
            var rights = await permissions.GetRightsInUnitAsync(id, unitCode, ct);
            if (DocumentActor.For(matrix, rights, function, isOwner: false, unitCode).Reaches(status)) result.Add(id);
        }
        return result.Order().ToList();
    }
}
