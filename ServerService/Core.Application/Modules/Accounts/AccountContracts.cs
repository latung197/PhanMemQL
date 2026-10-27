using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Accounts;

/// <param name="HasChildren">True when other accounts have this one as their parent: it only adds them up and is not posted to.</param>
public sealed record AccountDto(string Code, string Name, string? NameEn, string? ParentAccountCode, string? ParentAccountName, int Level,
    string AccountType, string Nature, bool HasChildren, string? Note, bool IsActive, RecordStampDto Stamp, uint Version);

/// <summary>
/// AccountType: ASSET, LIABILITY, EQUITY, REVENUE, COST, OTHER_INCOME, OTHER_EXPENSE, PROFIT_LOSS or OFF_BALANCE; Nature: DEBIT, CREDIT
/// or BOTH. A child account (ParentAccountCode) has its parent's code as prefix; the parent cannot be changed once saved.
/// </summary>
public sealed record SaveAccountRequest(string Code, string Name, string? NameEn, string? ParentAccountCode, string AccountType, string Nature,
    string? Note, bool IsActive = true, uint? Version = null) : ICatalogRequest;

/// <summary>
/// The chart of accounts on ICatalogService (paged list with the filters <c>level</c>, <c>type</c>, <c>parent</c> and <c>postable=true</c> —
/// active leaf accounts —, export, create, update, delete, import).
/// </summary>
public interface IAccountService : ICatalogService<AccountDto, SaveAccountRequest>;
