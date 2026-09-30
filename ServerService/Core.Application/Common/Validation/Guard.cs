using Core.Application.Common.Exceptions;

namespace Core.Application.Common.Validation;

/// <summary>Small input checks shared by the module services.</summary>
public static class Guard
{
    public static string Required(string? value, int maxLength, string label)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            throw new BusinessRuleException($"Vui lòng nhập {label}.");
        if (trimmed.Length > maxLength)
            throw new BusinessRuleException($"{label} không được vượt quá {maxLength} ký tự.");
        return trimmed;
    }

    public static string? Optional(string? value, int maxLength, string label)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        if (trimmed.Length > maxLength)
            throw new BusinessRuleException($"{label} không được vượt quá {maxLength} ký tự.");
        return trimmed;
    }

    /// <summary>Codes are stored in keys and scopes ("U:{code}"), so no spaces, ':' or ','.</summary>
    public static string Code(string? value, int maxLength, string label)
    {
        var code = Required(value, maxLength, label).ToUpperInvariant();
        if (code.Any(c => char.IsWhiteSpace(c) || c is ':' or ','))
            throw new BusinessRuleException($"{label} không được chứa khoảng trắng, dấu ':' hoặc ','.");
        return code;
    }
}
