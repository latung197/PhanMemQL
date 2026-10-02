using System.Text.RegularExpressions;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Localization;
using Npgsql;

namespace Core.Infrastructure.Common.Persistence;

/// <summary>
/// Turns database errors a user can cause into messages they can act on, instead of HTTP 500. Covers every write path
/// (EF SaveChanges, ExecuteUpdate, raw SQL), so services do not need to pre-check every unique value:
/// <list type="bullet">
/// <item>23505 unique violation → 409 record.duplicate, naming the field(s) and the value ("Tên "Kilogram" đã tồn tại");
/// field names are dbfield.{column} message keys (dbfield.value when a column has none);</item>
/// <item>40001 / 40P01 (serialization failure, deadlock: two saves touching the same rows) → 409 record.busy.</item>
/// </list>
/// The value needs Npgsql's IncludeErrorDetail (set by AddInfrastructure); without it only the field is named.
/// </summary>
public static partial class DatabaseErrors
{
    /// <summary>Tokens of an index expression that are not columns: lower((name)::text) → name.</summary>
    private static readonly HashSet<string> NotColumns = new(StringComparer.OrdinalIgnoreCase)
    {
        "lower", "upper", "trim", "coalesce", "text", "varchar", "character", "varying", "bpchar", "unaccent"
    };

    /// <summary>The user-facing error for a database exception (anywhere in the inner chain); null when not one of ours.</summary>
    public static AppException? Translate(Exception exception)
    {
        for (var e = exception; e is not null; e = e.InnerException)
        {
            if (e is not PostgresException pg) continue;
            return pg.SqlState switch
            {
                PostgresErrorCodes.UniqueViolation => Duplicate(pg.Detail, pg.ConstraintName),
                PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected => new ConflictException("record.busy"),
                _ => null
            };
        }
        return null;
    }

    public static ConflictException Duplicate(string? detail, string? constraint)
    {
        var (columns, value) = Parse(detail);
        if (columns.Count == 0 && constraint is not null) columns = ColumnsOfConstraint(constraint);
        var field = columns.Count == 0 ? Label("value") : string.Join(", ", columns.Select(Label));
        return value is null
            ? new ConflictException("record.duplicateField", field)
            : new ConflictException("record.duplicate", field, value);
    }

    /// <summary>"Key (lower((name)::text))=(kilogram) already exists." → ([name], "kilogram").</summary>
    public static (List<string> Columns, string? Value) Parse(string? detail)
    {
        var match = detail is null ? Match.Empty : KeyDetail().Match(detail);
        if (!match.Success) return ([], null);
        var columns = Identifier().Matches(match.Groups["columns"].Value).Select(m => m.Value)
            .Where(x => !NotColumns.Contains(x)).Distinct().ToList();
        return (columns, match.Groups["value"].Value);
    }

    /// <summary>Best guess from the constraint name when the detail is hidden: ux_erp_uom_name → name, erp_uom_pkey → code.</summary>
    private static List<string> ColumnsOfConstraint(string constraint) =>
        constraint.EndsWith("_pkey", StringComparison.Ordinal) ? ["code"]
        : constraint.Split('_').LastOrDefault() is { Length: > 0 } last ? [last] : [];

    private static string Label(string column) =>
        Messages.Find(Messages.CurrentLanguage, $"dbfield.{column}") is not null ? Messages.T($"dbfield.{column}") : Messages.T("dbfield.value");

    [GeneratedRegex(@"^Key \((?<columns>.+)\)=\((?<value>.*)\) already exists", RegexOptions.Singleline)]
    private static partial Regex KeyDetail();

    [GeneratedRegex(@"[A-Za-z_][A-Za-z0-9_]*")]
    private static partial Regex Identifier();
}
