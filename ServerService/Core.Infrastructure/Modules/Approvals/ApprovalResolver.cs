using Core.Application.Common.Localization;
using Core.Application.Common.Permissions;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Users;
using Core.Domain.Modules.Approvals;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Modules.Users;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Approvals;

/// <summary>Approvers of one approval level, already expanded to user ids.</summary>
public sealed record ResolvedApprovalLevel(int Level, string Label, IReadOnlyList<int> UserIds);

public sealed record ApprovalResolution(bool UsesDefaultApprovers, IReadOnlyList<ResolvedApprovalLevel> Levels);

/// <summary>
/// Turns the rules into concrete approvers for a document. An approver must be active, allowed in the
/// unit, hold the "Duyệt" right on the voucher or on its approval screen (PermissionMatrix.CanApprove) and must
/// not be the requester. Without a matching
/// rule, every user with the "Duyệt" right in the unit approves (one level).
/// </summary>
public sealed class ApprovalResolver(CoreContext db, IPermissionService permissions)
{
    public async Task<ApprovalResolution> ResolveAsync(string function, string unitCode, int requesterUserId,
        decimal? amount, CancellationToken ct)
    {
        var requester = await RequesterAsync(requesterUserId, ct);
        var rules = await db.ApprovalRules.AsNoTracking().Where(x => x.MenuId0 == function && x.IsActive).ToListAsync(ct);
        var levels = ApprovalRuleEngine.Resolve(rules, function, unitCode, requester, amount);
        var roleNames = await db.Roles.AsNoTracking().ToDictionaryAsync(x => x.RoleId.ToString(), x => x.RoleName, ct);
        var userNames = await db.Users.AsNoTracking().NotDeleted().ToDictionaryAsync(x => x.UserId.ToString(), x => x.FullName, ct);

        if (levels.Count == 0)
        {
            var everyone = await db.Users.AsNoTracking().ActiveUsers().Select(x => x.UserId).ToListAsync(ct);
            return new ApprovalResolution(true,
                [new ResolvedApprovalLevel(1, Messages.T("approval.defaultApprovers"), await FilterAsync(everyone, function, unitCode, requesterUserId, ct))]);
        }

        var result = new List<ResolvedApprovalLevel>();
        foreach (var level in levels)
        {
            var candidates = new List<int>();
            foreach (var approver in level.Approvers)
            {
                if (approver.Type == ApproverTypes.User && int.TryParse(approver.Value, out var userId)) candidates.Add(userId);
                else if (approver.Type == ApproverTypes.Role && int.TryParse(approver.Value, out var roleId))
                    candidates.AddRange(await db.UserRoles.ActiveRoles().Where(x => x.RoleId == roleId).Select(x => x.UserId).ToListAsync(ct));
            }
            var label = string.Join(", ", level.Approvers.Select(a => a.Type == ApproverTypes.Role
                ? Messages.T("approval.roleLabel", roleNames.GetValueOrDefault(a.Value, a.Value))
                : userNames.GetValueOrDefault(a.Value, $"#{a.Value}")));
            result.Add(new ResolvedApprovalLevel(level.Level, label, await FilterAsync(candidates.Distinct(), function, unitCode, requesterUserId, ct)));
        }
        return new ApprovalResolution(false, result);
    }

    public async Task<ApprovalRequester> RequesterAsync(int userId, CancellationToken ct)
    {
        var department = await db.Users.AsNoTracking().Where(x => x.UserId == userId).Select(x => x.DepartmentCode).FirstOrDefaultAsync(ct);
        var roleIds = await db.UserRoles.AsNoTracking().ActiveRoles().Where(x => x.UserId == userId).Select(x => x.RoleId).ToListAsync(ct);
        return new ApprovalRequester(userId, roleIds, department);
    }

    private async Task<List<int>> FilterAsync(IEnumerable<int> candidates, string function, string unitCode, int requesterUserId,
        CancellationToken ct)
    {
        var ids = candidates.Where(id => id != requesterUserId).Distinct().ToList();
        // Rights of every candidate at once (only active users come back), not a few queries per candidate.
        var matrices = await permissions.GetEffectiveManyAsync(ids, ct);
        var inUnit = (await db.UserCompanyUnits.AsNoTracking().Where(x => ids.Contains(x.UserId) && x.UnitCode == unitCode)
            .Select(x => x.UserId).ToListAsync(ct)).ToHashSet();
        var result = new List<int>();
        foreach (var (id, matrix) in matrices)
        {
            // Administrators may work in every unit (cached by GetEffectiveManyAsync, no query).
            if (!inUnit.Contains(id) && !await permissions.IsAdminAsync(id, ct)) continue;
            if (PermissionMatrix.CanApprove(matrix, function)) result.Add(id);
        }
        return result.Order().ToList();
    }
}
