using System.Text.Json;
using System.Text.RegularExpressions;
using Core.Application.Common.Exceptions;

namespace Core.Application.Common.Layouts;

/// <summary>The user's own layout of a list and the company default (null when not set; the screen then uses the code's).</summary>
public sealed record GridLayoutDto(JsonElement? User, JsonElement? Company);

public interface IGridLayoutService
{
    Task<GridLayoutDto> GetAsync(int userId, string functionCode, string gridKey, CancellationToken ct);

    /// <summary>userId null = company default (administrators only, checked by the caller).</summary>
    Task SaveAsync(int actorUserId, int? userId, string functionCode, string gridKey, JsonElement layout, CancellationToken ct);

    /// <summary>Back to the company default (userId) or to the code's default (null).</summary>
    Task ResetAsync(int? userId, string functionCode, string gridKey, CancellationToken ct);
}

/// <summary>Light checks of the JSON the frontend sends; the frontend ignores unknown or missing column keys.</summary>
public static partial class GridLayoutRules
{
    public const int MaxBytes = 16_000;
    public const int MaxColumns = 100;

    [GeneratedRegex("^[A-Za-z0-9_.:-]{1,64}$")]
    private static partial Regex KeyPattern();

    public static void ValidateKey(string gridKey)
    {
        if (!KeyPattern().IsMatch(gridKey ?? string.Empty)) throw new BusinessRuleException("gridLayout.invalid");
    }

    public static void Validate(JsonElement layout)
    {
        if (layout.ValueKind != JsonValueKind.Object || JsonSerializer.SerializeToUtf8Bytes(layout).Length > MaxBytes)
            throw new BusinessRuleException("gridLayout.invalid");
        if (!layout.TryGetProperty("columns", out var columns)) return;
        if (columns.ValueKind != JsonValueKind.Array || columns.GetArrayLength() > MaxColumns)
            throw new BusinessRuleException("gridLayout.invalid");
        foreach (var column in columns.EnumerateArray())
            if (column.ValueKind != JsonValueKind.Object || !column.TryGetProperty("key", out var key)
                || key.ValueKind != JsonValueKind.String || !KeyPattern().IsMatch(key.GetString()!))
                throw new BusinessRuleException("gridLayout.invalid");
    }
}
