using Core.Application.Common.Exceptions;

namespace Core.Application.Modules.VoucherGrids;

/// <summary>
/// One column of a grid as the voucher screens show it. Locked = it cannot be hidden (required columns). Type, Required, ReadOnly,
/// Summary come from the code and are only shown to the administrator; the screens take the rest (order, headers, width, decimals,
/// visibility) and apply them over the code's own declaration.
/// </summary>
public sealed record VoucherGridColumnDto(string Field, string Header, string? HeaderEn, string Type, int? Width, int? MinWidth, string Align,
    int? Decimals, bool Required, bool ReadOnly, bool Visible, bool Locked, string? Summary, string? SummaryFormat, int SortOrder);

public sealed record VoucherGridDto(string Code, string VoucherType, string VoucherName, string Name, string? NameEn, string TabKey, int TabOrder,
    bool AllowAddRow, bool AllowDeleteRow, int PinCount, IReadOnlyList<VoucherGridColumnDto> Columns, uint Version);

/// <summary>What the administrator may change of a column; the list is in the new order and must hold every column of the grid once.</summary>
public sealed record SaveVoucherGridColumn(string Field, string Header, string? HeaderEn, int? Width, int? MinWidth, int? Decimals, bool Visible);

public sealed record SaveVoucherGridRequest(int PinCount, IReadOnlyList<SaveVoucherGridColumn> Columns, uint? Version = null);

public interface IVoucherGridService
{
    /// <summary>Every grid with its columns in order (the voucher screens read this once after sign-in; cached).</summary>
    Task<IReadOnlyList<VoucherGridDto>> GetAllAsync(CancellationToken ct);

    Task<VoucherGridDto> UpdateAsync(int userId, string code, SaveVoucherGridRequest request, CancellationToken ct);
}

/// <summary>The rules a saved grid must follow (pure, tested in VoucherGridRulesTests).</summary>
public static class VoucherGridRules
{
    public const int MaxPinned = 5;
    public const int MinWidth = 40;
    public const int MaxWidth = 800;
    public const int MaxDecimals = 6;

    private static readonly HashSet<string> NumericTypes = new(StringComparer.Ordinal) { "number", "quantity", "currency", "percentage" };

    public static bool IsNumeric(string type) => NumericTypes.Contains(type);

    /// <summary>Throws BusinessRuleException with the message key of the first rule the request breaks.</summary>
    public static void Validate(SaveVoucherGridRequest request, IReadOnlyList<VoucherGridColumnDto> current)
    {
        if (request.Columns is null || request.Columns.Count != current.Count
            || request.Columns.Select(x => x.Field).Distinct(StringComparer.Ordinal).Count() != current.Count
            || current.Any(c => request.Columns.All(x => x.Field != c.Field)))
            throw new BusinessRuleException("voucherGrid.columnsMismatch");
        foreach (var column in request.Columns)
        {
            var existing = current.First(c => c.Field == column.Field);
            if (string.IsNullOrWhiteSpace(column.Header) || column.Header.Trim().Length > 200 || column.HeaderEn?.Trim().Length > 200)
                throw new BusinessRuleException("voucherGrid.headerInvalid", column.Field);
            if (column.Width is { } w && (w < MinWidth || w > MaxWidth) || column.MinWidth is { } m && (m < MinWidth || m > MaxWidth))
                throw new BusinessRuleException("voucherGrid.widthInvalid", column.Field, MinWidth, MaxWidth);
            if (column.Decimals is { } d && (d < 0 || d > MaxDecimals || !IsNumeric(existing.Type)))
                throw new BusinessRuleException("voucherGrid.decimalsInvalid", column.Field, MaxDecimals);
            if (!column.Visible && existing.Locked) throw new BusinessRuleException("voucherGrid.cannotHide", column.Field);
        }
        var visible = request.Columns.Count(x => x.Visible);
        if (request.PinCount < 0 || request.PinCount > MaxPinned || request.PinCount > visible)
            throw new BusinessRuleException("voucherGrid.pinInvalid", MaxPinned);
    }
}
