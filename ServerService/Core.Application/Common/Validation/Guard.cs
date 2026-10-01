using Core.Application.Common.Exceptions;
using Core.Application.Common.Localization;

namespace Core.Application.Common.Validation;

/// <summary>
/// Small input checks shared by the module services. <c>label</c> is a message key of the field
/// (e.g. "field.departmentName"), so the message is in the user's language.
/// </summary>
public static class Guard
{
    public static string Required(string? value, int maxLength, string label)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            throw new BusinessRuleException("validation.required", new Text(label));
        if (trimmed.Length > maxLength)
            throw new BusinessRuleException("validation.maxLength", new Text(label), maxLength);
        return trimmed;
    }

    public static string? Optional(string? value, int maxLength, string label)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        if (trimmed.Length > maxLength)
            throw new BusinessRuleException("validation.maxLength", new Text(label), maxLength);
        return trimmed;
    }

    /// <summary>Codes are stored in keys and scopes ("U:{code}"), so no spaces, ':' or ','.</summary>
    public static string Code(string? value, int maxLength, string label)
    {
        var code = Required(value, maxLength, label).ToUpperInvariant();
        if (code.Any(c => char.IsWhiteSpace(c) || c is ':' or ','))
            throw new BusinessRuleException("validation.codeChars", new Text(label));
        return code;
    }
}
