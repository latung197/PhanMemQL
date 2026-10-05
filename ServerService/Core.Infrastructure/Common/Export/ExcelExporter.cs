using Core.Application.Common.Export;
using Core.Application.Common.Localization;
using MiniExcelLibs;
using MiniExcelLibs.OpenXml;

namespace Core.Infrastructure.Common.Export;

public sealed class ExcelExporter : IExcelExporter
{
    public byte[] Write<T>(string sheetNameKey, IReadOnlyList<ExportColumn<T>> columns, IEnumerable<T> rows)
    {
        var headers = columns.Select(c => Messages.T(c.HeaderKey)).ToList();
        IEnumerable<IDictionary<string, object?>> table = rows.Select(row =>
        {
            var line = new Dictionary<string, object?>(columns.Count);
            for (var i = 0; i < columns.Count; i++) line[headers[i]] = Cell(columns[i].Value(row));
            return (IDictionary<string, object?>)line;
        });
        using var stream = new MemoryStream();
        MiniExcel.SaveAs(stream, table, sheetName: Messages.T(sheetNameKey), configuration: new OpenXmlConfiguration
        {
            AutoFilter = true, EnableAutoWidth = true, FastMode = true
        });
        return stream.ToArray();
    }

    private static object? Cell(object? value) => value switch
    {
        DateOnly date => date.ToDateTime(TimeOnly.MinValue),
        DateTimeOffset moment => moment.UtcDateTime,
        _ => value
    };
}
