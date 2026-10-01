using System.Text.RegularExpressions;
using Core.Application.Common.Documents;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Localization;
using Core.Application.Common.Permissions;
using Xunit;

namespace Core.Tests.Common;

/// <summary>
/// The user texts of the API (Common/Localization/Messages.*.json): every language has every text, every key the
/// code uses exists, and no Vietnamese sentence is written straight into an exception any more.
/// </summary>
public sealed partial class MessagesTests
{
    /// <summary>Names of functions and vouchers come from the C# catalogs in Vietnamese; other languages add them.</summary>
    private static bool CatalogName(string key) => key.StartsWith("function.", StringComparison.Ordinal) || key.StartsWith("voucher.", StringComparison.Ordinal);

    [Fact]
    public void VietnameseAndEnglishFilesAreLoaded()
    {
        Assert.Contains("vi", Messages.Languages);
        Assert.Contains("en", Messages.Languages);
    }

    [Fact]
    public void EveryLanguageHasEveryText()
    {
        var vi = Messages.Catalog("vi").Keys.ToHashSet();
        foreach (var language in Messages.Languages.Where(l => l != "vi"))
        {
            var other = Messages.Catalog(language).Keys.Where(k => !CatalogName(k)).ToHashSet();
            Assert.Empty(vi.Except(other).Select(k => $"{language} thiếu {k}"));
            Assert.Empty(other.Except(vi).Select(k => $"{language} thừa {k}"));
        }
    }

    [Fact]
    public void EveryFunctionAndVoucherHasAnEnglishName()
    {
        var en = Messages.Catalog("en");
        Assert.Empty(FunctionCatalog.Functions.Keys.Where(code => !en.ContainsKey($"function.{code}")));
        Assert.Empty(VoucherCatalog.All.Where(v => !en.ContainsKey($"voucher.{v.VoucherType}")).Select(v => v.VoucherType));
        // No name for a function or voucher that no longer exists.
        Assert.Empty(en.Keys.Where(k => k.StartsWith("function.", StringComparison.Ordinal) && !FunctionCatalog.IsFunction(k["function.".Length..])));
        Assert.Empty(en.Keys.Where(k => k.StartsWith("voucher.", StringComparison.Ordinal) && VoucherCatalog.FindByType(k["voucher.".Length..]) is null));
    }

    [Fact]
    public void SpecialRightsHaveNamesAndDescriptions()
    {
        var vi = Messages.Catalog("vi");
        Assert.All(SpecialRightCatalog.All, r =>
        {
            Assert.True(vi.ContainsKey($"right.{r.TextKey}.name"), r.TextKey);
            Assert.True(vi.ContainsKey($"right.{r.TextKey}.description"), r.TextKey);
        });
    }

    // ----- The keys the code uses -----

    [GeneratedRegex("""(?:Exception|Deny|Messages\.T|new Text)\(\s*"([a-zA-Z]+\.[\w.]+)"|Messages\.Format\([^,]+,\s*"([a-zA-Z]+\.[\w.]+)"|Guard\.(?:Required|Optional|Code)\([^;]*?,\s*\d+,\s*"([^"]+)"\)""")]
    private static partial Regex KeyUse();

    [GeneratedRegex("""throw new (?:BusinessRule|NotFound|Forbidden|AuthenticationFailed)Exception\(\s*\$?"[^"]*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]""", RegexOptions.IgnoreCase)]
    private static partial Regex VietnameseThrow();

    private static IEnumerable<(string File, string Text)> SourceFiles()
    {
        var root = AppContext.BaseDirectory;
        while (!File.Exists(Path.Combine(root, "Core.sln"))) root = Path.GetDirectoryName(root) ?? throw new InvalidOperationException("Core.sln not found");
        foreach (var project in new[] { "Core", "Core.Application", "Core.Infrastructure" })
            foreach (var file in Directory.EnumerateFiles(Path.Combine(root, project), "*.cs", SearchOption.AllDirectories)
                         .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
                                     && !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}")))
                yield return (Path.GetRelativePath(root, file), File.ReadAllText(file));
    }

    [Fact]
    public void EveryKeyTheCodeUsesExists()
    {
        var vi = Messages.Catalog("vi");
        var missing = SourceFiles()
            .SelectMany(f => KeyUse().Matches(f.Text).Select(m => (f.File, Key: m.Groups[1].Success ? m.Groups[1].Value
                : m.Groups[2].Success ? m.Groups[2].Value : m.Groups[3].Value)))
            .Where(x => !vi.ContainsKey(x.Key))
            .Select(x => $"{x.File}: {x.Key}")
            .Distinct()
            .ToList();
        Assert.Empty(missing);
    }

    [Fact]
    public void NoVietnameseSentenceIsThrownDirectly()
    {
        var found = SourceFiles().Where(f => VietnameseThrow().IsMatch(f.Text)).Select(f => f.File).ToList();
        Assert.Empty(found);
    }

    // ----- How texts are built -----

    [Fact]
    public void TranslatesAndFallsBack()
    {
        Assert.Equal("Wrong username or password.", Messages.Format("en", "auth.wrongCredentials"));
        Assert.Equal("Wrong username or password.", Messages.Format("en-US", "auth.wrongCredentials"));  // base language
        Assert.Equal("Tên đăng nhập hoặc mật khẩu không đúng.", Messages.Format("ja", "auth.wrongCredentials"));  // no file: Vietnamese
        Assert.Equal("Một câu thường", Messages.Format("en", "Một câu thường"));  // unknown key: shown as it is
    }

    [Fact]
    public void FillsArgumentsAndTranslatesLabels()
    {
        Assert.Equal("Vui lòng nhập tên phòng ban.", Messages.Format("vi", "validation.required", new Text("field.departmentName")));
        // A label at the start of the sentence gets a capital.
        Assert.Equal("Department name must not exceed 100 characters.",
            Messages.Format("en", "validation.maxLength", new Text("field.departmentName"), 100));
        // Pattern tokens are not placeholders.
        Assert.Equal("The number pattern must contain {SEQ} (sequence number).", Messages.Format("en", "numbering.seqRequired"));
    }

    [Theory]
    [InlineData("en-US,en;q=0.9,vi;q=0.8", "en-us")]
    [InlineData("vi", "vi")]
    [InlineData("", null)]
    [InlineData("*", null)]
    public void ReadsTheAcceptLanguageHeader(string header, string? expected) => Assert.Equal(expected, Messages.Normalize(header));

    [Fact]
    public void ExceptionsUseTheLanguageOfTheRequest()
    {
        var before = Messages.CurrentLanguage;
        try
        {
            Messages.CurrentLanguage = "en";
            Assert.Equal("Department code PB01 already exists.", new BusinessRuleException("department.codeExists", "PB01").Message);
            Messages.CurrentLanguage = "vi";
            Assert.Equal("Mã phòng ban PB01 đã tồn tại.", new BusinessRuleException("department.codeExists", "PB01").Message);
        }
        finally
        {
            Messages.CurrentLanguage = before;
        }
    }
}
