using Core.Application.Common.Auditing;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Application.Common.Validation;
using Core.Application.Modules.Approvals;
using Core.Domain.Modules.Approvals;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Modules.Users;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Approvals;

public sealed class ApprovalRuleService(CoreContext db, ApprovalResolver resolver, IAuditLog auditLog) : IApprovalRuleService
{
    private static readonly string[] RequesterTypeList = [RequesterTypes.Any, RequesterTypes.User, RequesterTypes.Role, RequesterTypes.Department];
    private static readonly string[] ApproverTypeList = [ApproverTypes.User, ApproverTypes.Role];

    public async Task<IReadOnlyList<ApprovalRuleDto>> GetAllAsync(string? function, CancellationToken ct)
    {
        var query = db.ApprovalRules.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(function)) query = query.Where(x => x.MenuId0 == function);
        var rules = await query.OrderBy(x => x.MenuId0).ThenBy(x => x.Level).ThenBy(x => x.Id).ToListAsync(ct);
        return rules.Select(ToDto).ToList();
    }

    public async Task<ApprovalRuleDto> CreateAsync(int actorUserId, SaveApprovalRuleRequest request, CancellationToken ct)
    {
        var rule = new ApprovalRule();
        await ApplyAsync(rule, actorUserId, request, ct);
        db.ApprovalRules.Add(rule);
        await AttachNamesAsync(rule, null, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(rule);
    }

    public async Task<ApprovalRuleDto> UpdateAsync(int actorUserId, long id, SaveApprovalRuleRequest request, CancellationToken ct)
    {
        var rule = await db.ApprovalRules.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new NotFoundException("approval.ruleNotFound");
        db.ExpectVersion(rule, request.Version);
        var before = await NamesOfAsync(rule, ct);
        await ApplyAsync(rule, actorUserId, request, ct);
        await AttachNamesAsync(rule, before, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(rule);
    }

    public async Task DeleteAsync(long id, CancellationToken ct)
    {
        var rule = await db.ApprovalRules.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new NotFoundException("approval.ruleNotFound");
        auditLog.Attach(rule, new AuditDiff().Fields(await NamesOfAsync(rule, ct), null).Changes);
        db.ApprovalRules.Remove(rule);
        await db.SaveChangesAsync(ct);
    }

    public async Task<ApprovalPreview> PreviewAsync(PreviewApprovalRequest request, string defaultUnitCode, CancellationToken ct)
    {
        if (!FunctionCatalog.IsFunction(request.Function)) throw new BusinessRuleException("approval.invalidFunction");
        var unit = string.IsNullOrWhiteSpace(request.UnitCode) ? defaultUnitCode : request.UnitCode.Trim();
        var resolution = await resolver.ResolveAsync(request.Function, unit, request.RequesterUserId, request.Amount, ct);
        var ids = resolution.Levels.SelectMany(l => l.UserIds).Distinct().ToList();
        var users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId))
            .Select(x => new ApproverUserDto(x.UserId.ToString(), x.UserName, x.FullName)).ToListAsync(ct);
        return new ApprovalPreview(resolution.UsesDefaultApprovers, resolution.Levels.Select(l => new ApprovalLevelPreview(
            l.Level, l.Label, users.Where(u => l.UserIds.Contains(int.Parse(u.Id))).ToList())).ToList());
    }

    private async Task ApplyAsync(ApprovalRule rule, int actorUserId, SaveApprovalRuleRequest request, CancellationToken ct)
    {
        if (!FunctionCatalog.IsFunction(request.Function)) throw new BusinessRuleException("approval.invalidFunction");
        if (request.Level is < 1 or > 9) throw new BusinessRuleException("approval.invalidLevel");
        if (!RequesterTypeList.Contains(request.RequesterType)) throw new BusinessRuleException("approval.invalidRequesterType");
        if (!ApproverTypeList.Contains(request.ApproverType)) throw new BusinessRuleException("approval.invalidApproverType");
        if (request.MinAmount < 0) throw new BusinessRuleException("approval.negativeAmount");

        var unit = Guard.Optional(request.UnitCode, 20, "field.unit");
        if (unit is not null && !await db.CompanyUnits.AnyAsync(x => x.Code == unit, ct))
            throw new BusinessRuleException("companyUnit.notFound");

        var requesterValue = request.RequesterType == RequesterTypes.Any ? null
            : Guard.Required(request.RequesterValue, 100, "field.requesterValue");
        if (request.RequesterType == RequesterTypes.User) await EnsureUserAsync(requesterValue!, ct);
        if (request.RequesterType == RequesterTypes.Role) await EnsureRoleAsync(requesterValue!, ct);
        if (request.RequesterType == RequesterTypes.Department)
        {
            requesterValue = requesterValue!.ToUpperInvariant();
            if (!await db.Departments.AnyAsync(x => x.Code == requesterValue, ct))
                throw new BusinessRuleException("department.notFound");
        }

        var approverValue = Guard.Required(request.ApproverValue, 100, "field.approver");
        if (request.ApproverType == ApproverTypes.User) await EnsureUserAsync(approverValue, ct);
        else await EnsureRoleAsync(approverValue, ct);

        rule.MenuId0 = request.Function;
        rule.UnitCode = unit;
        rule.Level = request.Level;
        rule.RequesterType = request.RequesterType;
        rule.RequesterValue = requesterValue;
        rule.MinAmount = request.MinAmount;
        rule.ApproverType = request.ApproverType;
        rule.ApproverValue = approverValue;
        rule.Note = Guard.Optional(request.Note, 500, "field.note");
        rule.IsActive = request.IsActive;
        rule.UpdatedAtUtc = DateTime.UtcNow;
        rule.UpdatedByUserId = actorUserId;
    }

    /// <summary>
    /// The automatic log has the rule's columns; the requester and approver are ids there, so their names are added
    /// (fields "requester" / "approver").
    /// </summary>
    private async Task AttachNamesAsync(ApprovalRule rule, IReadOnlyDictionary<string, object?>? before, CancellationToken ct) =>
        auditLog.Attach(rule, new AuditDiff().Fields(before, await NamesOfAsync(rule, ct)).Changes);

    private async Task<Dictionary<string, object?>> NamesOfAsync(ApprovalRule rule, CancellationToken ct) => new()
    {
        ["requester"] = await NameOfAsync(rule.RequesterType, rule.RequesterValue, ct),
        ["approver"] = await NameOfAsync(rule.ApproverType, rule.ApproverValue, ct)
    };

    private async Task<string?> NameOfAsync(string type, string? value, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(value)) return null;
        var id = int.TryParse(value, out var n) ? n : 0;
        var name = type switch
        {
            // Requester and approver types share the codes USER / ROLE.
            RequesterTypes.User => await db.Users.AsNoTracking().Where(x => x.UserId == id)
                .Select(x => x.FullName + " (@" + x.UserName + ")").FirstOrDefaultAsync(ct),
            RequesterTypes.Role => await db.Roles.AsNoTracking().Where(x => x.RoleId == id)
                .Select(x => x.RoleName).FirstOrDefaultAsync(ct),
            RequesterTypes.Department => await db.Departments.AsNoTracking().Where(x => x.Code == value)
                .Select(x => x.Name).FirstOrDefaultAsync(ct),
            _ => null
        };
        return name ?? value;
    }

    private async Task EnsureUserAsync(string value, CancellationToken ct)
    {
        if (!int.TryParse(value, out var id) || !await db.Users.NotDeleted().AnyAsync(x => x.UserId == id, ct))
            throw new BusinessRuleException("users.notFound");
    }

    private async Task EnsureRoleAsync(string value, CancellationToken ct)
    {
        if (!int.TryParse(value, out var id) || !await db.Roles.AnyAsync(x => x.RoleId == id && x.ValidFlg == 1, ct))
            throw new BusinessRuleException("roles.notFound");
    }

    private static ApprovalRuleDto ToDto(ApprovalRule x) => new(x.Id.ToString(), x.MenuId0, x.UnitCode, x.Level,
        x.RequesterType, x.RequesterValue, x.MinAmount, x.ApproverType, x.ApproverValue, x.Note, x.IsActive, x.Version);
}
