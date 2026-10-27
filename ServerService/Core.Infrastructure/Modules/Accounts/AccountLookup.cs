using Core.Application.Common.Lookups;
using Core.Infrastructure.Common.Lookups;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Accounts;

/// <summary>
/// Tra cứu tài khoản kế toán (<c>GET /api/lookups/accounts</c>): code, name and the level, type and nature as extra values. The parameter
/// <c>postable=true</c> lists only the accounts a voucher may post to (active, no children): the picker of the tax codes uses it;
/// <c>type=ASSET</c> narrows to one type.
/// </summary>
public sealed class AccountLookup(CoreContext db) : LookupProvider
{
    public override string Name => "accounts";

    public override IReadOnlyCollection<string> Tables => ["erp_account"];

    public override IReadOnlyCollection<string> ParameterNames => ["postable", "type"];

    public override async Task<IReadOnlyList<LookupItem>> LoadAsync(LookupContext context, CancellationToken ct)
    {
        var rows = db.Accounts.AsNoTracking().AsQueryable();
        if (context.Param("postable") == "true") rows = rows.Where(x => x.IsActive && !db.Accounts.Any(c => c.ParentAccountCode == x.Code));
        if (context.Param("type")?.ToUpperInvariant() is { } type) rows = rows.Where(x => x.AccountType == type);
        var list = await rows.OrderBy(x => x.Code).ToListAsync(ct);
        return list.Select(x => new LookupItem(x.Code, x.Name, x.IsActive, new Dictionary<string, object?>
        {
            ["level"] = x.Level, ["accountType"] = x.AccountType, ["nature"] = x.Nature, ["parentAccountCode"] = x.ParentAccountCode
        })).ToList();
    }
}
