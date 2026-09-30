using System.Text.RegularExpressions;
using Core.Application.Common.Exceptions;

namespace Core.Application.Modules.VoucherNumbering;

/// <summary>NextNumber = the number the next voucher of the signed-in unit would get today (preview only).</summary>
public sealed record VoucherNumberingDto(string VoucherType, string Function, string Name, string Prefix, string Pattern,
    int Digits, string NextNumber);

public sealed record SaveVoucherNumberingRequest(string Prefix, string Pattern, int Digits);

public interface IVoucherNumberService
{
    Task<IReadOnlyList<VoucherNumberingDto>> GetAllAsync(string unitCode, CancellationToken ct);

    Task<VoucherNumberingDto> UpdateAsync(int userId, string voucherType, SaveVoucherNumberingRequest request,
        string unitCode, CancellationToken ct);

    /// <summary>The number the next voucher would get, without using it up.</summary>
    Task<string> PreviewAsync(string voucherType, string unitCode, DateOnly date, CancellationToken ct);

    /// <summary>
    /// Takes the next number of the series. Voucher services call it inside their save transaction
    /// (IUnitOfWork), so a failed save does not use up a number.
    /// </summary>
    Task<string> NextAsync(string voucherType, string unitCode, DateOnly date, CancellationToken ct);
}

/// <summary>
/// Voucher number patterns. Tokens: {PREFIX}, {DVCS} (company unit), {YYYY}, {YY}, {MM}, {DD} and {SEQ}
/// (required). The sequence restarts whenever the date part of the pattern changes: every day with
/// {DD}, every month with {MM}, every year with {YYYY}/{YY}, never without a date.
/// </summary>
public static partial class VoucherNumberFormat
{
    public static readonly string[] Tokens = ["{PREFIX}", "{DVCS}", "{YYYY}", "{YY}", "{MM}", "{DD}", "{SEQ}"];

    [GeneratedRegex(@"\{[^}]*\}")]
    private static partial Regex TokenPattern();

    public static void Validate(string pattern, string prefix, int digits)
    {
        if (!pattern.Contains("{SEQ}", StringComparison.Ordinal))
            throw new BusinessRuleException("Mẫu số chứng từ phải có {SEQ} (số thứ tự).");
        var unknown = TokenPattern().Matches(pattern).Select(m => m.Value).FirstOrDefault(t => !Tokens.Contains(t));
        if (unknown is not null)
            throw new BusinessRuleException($"Mẫu số chứng từ có ký hiệu không hợp lệ: {unknown}.");
        if (digits is < 1 or > 10) throw new BusinessRuleException("Số chữ số của số thứ tự phải từ 1 đến 10.");
        if (prefix.Any(char.IsWhiteSpace)) throw new BusinessRuleException("Tiền tố không được chứa khoảng trắng.");
    }

    public static string PeriodKey(string pattern, DateOnly date) =>
        pattern.Contains("{DD}") ? date.ToString("yyyyMMdd")
        : pattern.Contains("{MM}") ? date.ToString("yyyyMM")
        : pattern.Contains("{YYYY}") || pattern.Contains("{YY}") ? date.ToString("yyyy")
        : "ALL";

    public static string Format(string pattern, string prefix, int digits, string unitCode, DateOnly date, int number) =>
        pattern.Replace("{PREFIX}", prefix).Replace("{DVCS}", unitCode)
            .Replace("{YYYY}", date.ToString("yyyy")).Replace("{YY}", date.ToString("yy"))
            .Replace("{MM}", date.ToString("MM")).Replace("{DD}", date.ToString("dd"))
            .Replace("{SEQ}", number.ToString().PadLeft(digits, '0'));
}
