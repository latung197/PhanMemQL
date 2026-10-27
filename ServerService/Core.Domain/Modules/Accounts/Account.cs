using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Core.Domain.Common;

namespace Core.Domain.Modules.Accounts;

/// <summary>
/// Tài khoản kế toán (hệ thống tài khoản theo Thông tư 200), nhiều cấp: a child account has the code of its parent as prefix
/// (133 → 1331 → 13311). A parent only adds up its children; only a leaf (no children) is posted to.
/// </summary>
[Audited("fin_account_cat", "account", Label = "{Code} - {Name}")]
[Table("erp_account")]
public class Account : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(20)] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(200)] public string Name { get; set; } = string.Empty;
    [Column("name_en"), MaxLength(200)] public string? NameEn { get; set; }
    /// <summary>The parent account; empty for a first level account. Fixed once the account is saved.</summary>
    [NotReference("trỏ chính bảng này (cha - con); AccountService kiểm tra tài khoản cha khi lưu và không cho xóa tài khoản còn tài khoản con")]
    [Column("parent_account_code"), MaxLength(20)] public string? ParentAccountCode { get; set; }
    /// <summary>1 for a first level account, parent level + 1 below it.</summary>
    [Column("level")] public int Level { get; set; } = 1;
    /// <summary>One of <see cref="AccountTypes"/>.</summary>
    [Required, Column("account_type"), MaxLength(20)] public string AccountType { get; set; } = AccountTypes.Asset;
    /// <summary>The side the balance normally sits on (<see cref="AccountNatures"/>): DEBIT, CREDIT or BOTH.</summary>
    [Required, Column("nature"), MaxLength(10)] public string Nature { get; set; } = AccountNatures.Debit;
    [Column("note"), MaxLength(300)] public string? Note { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}

public static class AccountTypes
{
    public const string Asset = "ASSET";
    public const string Liability = "LIABILITY";
    public const string Equity = "EQUITY";
    public const string Revenue = "REVENUE";
    public const string Cost = "COST";
    public const string OtherIncome = "OTHER_INCOME";
    public const string OtherExpense = "OTHER_EXPENSE";
    public const string ProfitLoss = "PROFIT_LOSS";
    public const string OffBalance = "OFF_BALANCE";
    public static readonly IReadOnlyList<string> All = [Asset, Liability, Equity, Revenue, Cost, OtherIncome, OtherExpense, ProfitLoss, OffBalance];
}

public static class AccountNatures
{
    public const string Debit = "DEBIT";
    public const string Credit = "CREDIT";
    public const string Both = "BOTH";
    public static readonly IReadOnlyList<string> All = [Debit, Credit, Both];
}
