using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Accounts;
using Core.Domain.Common;
using Core.Domain.Modules.Accounts;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Accounts;

/// <summary>
/// Hệ thống tài khoản kế toán on the shared CatalogService. Rules: a child account's code starts with its parent's code and is longer;
/// the parent is fixed once saved (so levels never need rewriting); an account that tax codes post to cannot get children (it would
/// stop being a leaf); a parent cannot be stopped while it has active children, and a child cannot be active under a stopped parent.
/// Accounts that other tables point to (parents, tax codes) cannot be deleted: [References] does that.
/// </summary>
public sealed class AccountService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<Account, AccountDto, SaveAccountRequest>(db, batch, excel, audit), IAccountService
{
    private static readonly CatalogSpec Info = new("fin_account_cat", "account", "field.accountCode", 20, "HeThongTaiKhoanKeToan");

    // The default order ("tree") is the code: a child's code starts with its parent's, so the list reads as a tree; the off balance
    // accounts (class 0) come last, as in the circular.
    private static readonly SortMap<Account> SortColumns = SortMap<Account>.By(x => x.Code, "tree")
        .Add("tree", x => x.Code.StartsWith("0") ? "Z" + x.Code : x.Code)
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("level", x => x.Level)
        .Add("accountType", x => x.AccountType).Add("nature", x => x.Nature).Add("parentAccountCode", x => x.ParentAccountCode)
        .Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<Account> Sorts => SortColumns;

    protected override IQueryable<Account> Search(IQueryable<Account> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern)
            || SearchFunctions.Matches(x.NameEn, pattern) || SearchFunctions.Matches(x.Note, pattern));

    /// <summary>Filters: <c>level=2</c>, <c>type=ASSET</c>, <c>parent=333</c> (its children), <c>postable=true</c> (active accounts without children).</summary>
    protected override IQueryable<Account> ApplyFilters(IQueryable<Account> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("level", out var level) && int.TryParse(level, out var n)) rows = rows.Where(x => x.Level == n);
        if (filters.TryGetValue("type", out var type) && !string.IsNullOrWhiteSpace(type)) { var code = type.Trim().ToUpperInvariant(); rows = rows.Where(x => x.AccountType == code); }
        if (filters.TryGetValue("parent", out var parent) && !string.IsNullOrWhiteSpace(parent)) { var code = parent.Trim().ToUpperInvariant(); rows = rows.Where(x => x.ParentAccountCode == code); }
        if (filters.TryGetValue("postable", out var postable) && postable == "true")
            rows = rows.Where(x => x.IsActive && !Db.Accounts.Any(c => c.ParentAccountCode == x.Code));
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<Account>> ExportColumns() =>
    [
        new("export.account.code", x => x.Code), new("export.account.name", x => x.Name), new("export.account.nameEn", x => x.NameEn),
        new("export.account.parentAccountCode", x => x.ParentAccountCode), new("export.account.level", x => x.Level),
        new("export.account.accountType", x => x.AccountType), new("export.account.nature", x => x.Nature),
        new("export.account.note", x => x.Note), new("export.account.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveAccountRequest WithoutVersion(SaveAccountRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<AccountDto>> MapAsync(IReadOnlyList<Account> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var codes = rows.Select(x => x.Code).ToList();
        var withChildren = (await Db.Accounts.AsNoTracking().Where(x => x.ParentAccountCode != null && codes.Contains(x.ParentAccountCode))
            .Select(x => x.ParentAccountCode!).Distinct().ToListAsync(ct)).ToHashSet();
        var parentCodes = rows.Select(x => x.ParentAccountCode).OfType<string>().Distinct().ToList();
        var parentNames = await Db.Accounts.AsNoTracking().Where(x => parentCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        return rows.Select(x => new AccountDto(x.Code, x.Name, x.NameEn, x.ParentAccountCode,
            x.ParentAccountCode is null ? null : parentNames.GetValueOrDefault(x.ParentAccountCode), x.Level, x.AccountType, x.Nature,
            withChildren.Contains(x.Code), x.Note, x.IsActive, stamp(x), x.Version)).ToList();
    }

    protected override async Task ApplyAsync(Account row, SaveAccountRequest request, CancellationToken ct)
    {
        var isNew = Db.Entry(row).State == EntityState.Detached;
        row.Name = Guard.Required(request.Name, 200, "field.accountName");
        row.NameEn = Guard.Optional(request.NameEn, 200, "field.accountNameEn");
        row.Note = Guard.Optional(request.Note, 300, "field.note");

        var type = (request.AccountType ?? string.Empty).Trim().ToUpperInvariant();
        if (!AccountTypes.All.Contains(type)) throw new BusinessRuleException("account.typeInvalid");
        var nature = (request.Nature ?? string.Empty).Trim().ToUpperInvariant();
        if (!AccountNatures.All.Contains(nature)) throw new BusinessRuleException("account.natureInvalid");
        row.AccountType = type;
        row.Nature = nature;

        var parentCode = string.IsNullOrWhiteSpace(request.ParentAccountCode) ? null : Guard.Code(request.ParentAccountCode, 20, "field.parentAccountCode");
        if (!isNew && !string.Equals(parentCode, row.ParentAccountCode, StringComparison.Ordinal)) throw new BusinessRuleException("account.parentLocked");
        if (isNew && parentCode is not null)
        {
            var parent = await Db.Accounts.AsNoTracking().FirstOrDefaultAsync(x => x.Code == parentCode, ct)
                ?? throw new BusinessRuleException("account.parentNotFound", parentCode);
            if (!parent.IsActive) throw new BusinessRuleException("account.parentInactive", parentCode);
            if (!row.Code.StartsWith(parentCode, StringComparison.Ordinal) || row.Code.Length <= parentCode.Length)
                throw new BusinessRuleException("account.codePrefix", row.Code, parentCode);
            // The parent stops being a leaf: tax codes must not keep posting to it.
            if (await Db.TaxRates.AnyAsync(x => x.InputAccountCode == parentCode || x.OutputAccountCode == parentCode, ct))
                throw new BusinessRuleException("account.parentUsedByTax", parentCode);
            row.ParentAccountCode = parentCode;
            row.Level = parent.Level + 1;
        }
        else if (isNew) { row.ParentAccountCode = null; row.Level = 1; }

        if (!request.IsActive && !isNew && await Db.Accounts.AnyAsync(x => x.ParentAccountCode == row.Code && x.IsActive, ct))
            throw new BusinessRuleException("account.activeChildren", row.Code);
        if (request.IsActive && row.ParentAccountCode is { } p && !await Db.Accounts.AnyAsync(x => x.Code == p && x.IsActive, ct))
            throw new BusinessRuleException("account.parentInactive", p);
        row.IsActive = request.IsActive;
    }

    /// <summary>A parent cannot be deleted while it has children (the parent column points to this very table, so [References] does not cover it).</summary>
    protected override async Task BeforeDeleteAsync(Account row, CancellationToken ct)
    {
        if (await Db.Accounts.AnyAsync(x => x.ParentAccountCode == row.Code, ct)) throw new BusinessRuleException("account.hasChildren", row.Code);
    }
}
