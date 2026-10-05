using System.Globalization;
using System.Text;

namespace Core.Infrastructure.Common.Paging;

/// <summary>
/// Search that ignores accents and case, the way Vietnamese users type ("thung" finds "Thùng", "mililit" finds "Mililít").
/// <see cref="Matches"/> runs in the database (the SQL function <c>sys_search_match</c> in 00-helpers.sql: unaccent + ILIKE);
/// <see cref="Fold"/> does the same in memory (cached lookups). Both must follow the same rules.
/// </summary>
public static class SearchFunctions
{
    /// <summary>
    /// For queries only: <c>rows.Where(x =&gt; SearchFunctions.Matches(x.Name, pattern))</c>. <paramref name="pattern"/> comes from
    /// <see cref="PagingExtensions.ContainsPattern"/> (or the same shape for "starts with"). A null <paramref name="text"/> never matches.
    /// </summary>
    public static bool Matches(string? text, string pattern) =>
        throw new NotSupportedException("SearchFunctions.Matches is translated to SQL; use it inside a query only.");

    /// <summary>The text without accents (đ becomes d) and in lower case.</summary>
    public static string Fold(string? text)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;
        var decomposed = text.Normalize(NormalizationForm.FormD);
        var result = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            result.Append(c switch { 'đ' => 'd', 'Đ' => 'D', _ => c });
        }
        return result.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }
}
