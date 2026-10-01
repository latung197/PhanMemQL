using System.Globalization;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Core.Application.Common.Localization;

/// <summary>A translatable argument of a message, e.g. a field label: new Text("field.departmentName").</summary>
public sealed class Text(string key, params object?[] args)
{
    public string Key { get; } = key;
    public object?[] Args { get; } = args;
}

/// <summary>
/// Texts the API sends to users (error messages, labels, notification texts), one file per language:
/// Common/Localization/Messages.{code}.json (embedded). The language of a request is its Accept-Language
/// (set per request by the API, see <see cref="CurrentLanguage"/>); a missing text falls back to the base
/// language (zh-cn → zh), then Vietnamese, then the key itself, so a plain sentence passed as a key still shows.
/// Placeholders are {0}, {1}...; other braces (e.g. "{SEQ}") are kept.
/// </summary>
public static partial class Messages
{
    public const string DefaultLanguage = "vi";

    private static readonly AsyncLocal<string?> Current = new();

    private static readonly IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> Catalogs = Load();

    [GeneratedRegex(@"\{(\d+)\}")]
    private static partial Regex Placeholder();

    /// <summary>Language of the current request ("vi" outside requests, e.g. background services).</summary>
    public static string CurrentLanguage
    {
        get => Current.Value ?? DefaultLanguage;
        set => Current.Value = Normalize(value);
    }

    /// <summary>Languages that have a message file.</summary>
    public static IReadOnlyCollection<string> Languages => (IReadOnlyCollection<string>)Catalogs.Keys;

    public static IReadOnlyDictionary<string, string> Catalog(string language) =>
        Catalogs.TryGetValue(language, out var catalog) ? catalog : new Dictionary<string, string>();

    /// <summary>The text in the language of the current request.</summary>
    public static string T(string key, params object?[] args) => Format(CurrentLanguage, key, args);

    /// <summary>The text in a given language (e.g. a notification in the recipient's language).</summary>
    public static string Format(string? language, string key, params object?[] args) =>
        Fill(Find(language, key) ?? key, language, args);

    /// <summary>The template of a key in the language or its fallbacks; null when no file has it.</summary>
    public static string? Find(string? language, string key)
    {
        foreach (var code in Chain(language))
            if (Catalogs.TryGetValue(code, out var catalog) && catalog.TryGetValue(key, out var template))
                return template;
        return null;
    }

    private static IEnumerable<string> Chain(string? language)
    {
        var code = Normalize(language);
        if (code is not null)
        {
            yield return code;
            var dash = code.IndexOf('-');
            if (dash > 0) yield return code[..dash];
        }
        yield return DefaultLanguage;
    }

    private static string Fill(string template, string? language, object?[] args)
    {
        if (args.Length == 0) return template;
        return Placeholder().Replace(template, match =>
        {
            var index = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
            var value = index < args.Length ? Render(args[index], language) : match.Value;
            // A label that starts the sentence starts with a capital ("Tên phòng ban không được...").
            return match.Index == 0 && value.Length > 0 ? char.ToUpper(value[0], CultureInfo.InvariantCulture) + value[1..] : value;
        });
    }

    private static string Render(object? arg, string? language) => arg switch
    {
        null => string.Empty,
        Text text => Format(language, text.Key, text.Args),
        IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture),
        _ => arg.ToString() ?? string.Empty
    };

    /// <summary>"en-US,en;q=0.9" → "en-us"; null for an empty value.</summary>
    public static string? Normalize(string? language)
    {
        if (string.IsNullOrWhiteSpace(language)) return null;
        var first = language.Split(',')[0].Split(';')[0].Trim().ToLowerInvariant();
        return first.Length == 0 || first == "*" ? null : first;
    }

    private static IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> Load()
    {
        var assembly = typeof(Messages).Assembly;
        const string marker = ".Localization.Messages.";
        var result = new Dictionary<string, IReadOnlyDictionary<string, string>>(StringComparer.Ordinal);
        foreach (var name in assembly.GetManifestResourceNames().Where(n => n.Contains(marker, StringComparison.Ordinal) && n.EndsWith(".json", StringComparison.Ordinal)))
        {
            var code = name[(name.IndexOf(marker, StringComparison.Ordinal) + marker.Length)..^".json".Length].ToLowerInvariant();
            using var stream = assembly.GetManifestResourceStream(name)!;
            result[code] = JsonSerializer.Deserialize<Dictionary<string, string>>(stream)
                ?? new Dictionary<string, string>();
        }
        return result;
    }
}
