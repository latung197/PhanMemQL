namespace Core.Application.Common.Catalogs;

/// <summary>
/// Rows of an Excel file sent by a catalog screen (Nhập Excel), already read into the catalog's save request.
/// Mode "create" adds new codes only (an existing code is an error); "upsert" also updates existing codes and needs
/// the edit right as well. All rows are saved or none (one transaction); every row is checked with the same rules as
/// the form, and the errors come back by row.
/// </summary>
public sealed record ImportRequest<T>(IReadOnlyList<T> Rows, string? Mode = ImportModes.Create)
{
    public bool IsUpsert => string.Equals(Mode, ImportModes.Upsert, StringComparison.OrdinalIgnoreCase);
}

public static class ImportModes
{
    public const string Create = "create";
    public const string Upsert = "upsert";
}

/// <summary>Row = 1-based position in the request (the screen maps it back to the Excel row).</summary>
public sealed record RowError(int Row, string Message);

/// <summary>Nothing is saved when Errors is not empty.</summary>
public sealed record ImportResult(int Created, int Updated, IReadOnlyList<RowError> Errors);

public sealed record DeleteManyRequest(IReadOnlyList<string> Keys);

/// <summary>Nothing is deleted when Errors is not empty (Row = position in Keys).</summary>
public sealed record DeleteManyResult(int Deleted, IReadOnlyList<RowError> Errors);

public static class CatalogBatchLimits
{
    public const int MaxRows = 5000;
    /// <summary>A file full of mistakes stops being checked after this many errors.</summary>
    public const int MaxErrors = 200;
}
