namespace Core.Application.Common.Export;

/// <summary>One column of an export. <paramref name="HeaderKey"/> is a message key, so the header follows the user's language.</summary>
public sealed record ExportColumn<T>(string HeaderKey, Func<T, object?> Value);

public sealed record ExportFile(byte[] Content, string FileName)
{
    public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

/// <summary>Writes rows to an .xlsx file (header row, auto filter, real numbers and dates).</summary>
public interface IExcelExporter
{
    byte[] Write<T>(string sheetNameKey, IReadOnlyList<ExportColumn<T>> columns, IEnumerable<T> rows);
}
