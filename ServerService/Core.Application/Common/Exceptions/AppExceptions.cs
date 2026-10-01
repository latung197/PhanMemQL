using Core.Application.Common.Localization;

namespace Core.Application.Common.Exceptions;

/// <summary>
/// Errors raised by services. The API maps them to HTTP status codes and returns <c>{ message }</c>, so the message
/// is written for the end user: <paramref name="key"/> is a key of Common/Localization/Messages.*.json (a plain
/// sentence also works and is shown as it is), translated into the language of the request.
/// </summary>
public abstract class AppException(string key, params object?[] args) : Exception(Messages.T(key, args))
{
    /// <summary>Message key (or the plain sentence it was raised with).</summary>
    public string Key { get; } = key;
}

/// <summary>Invalid input or a violated business rule (HTTP 400).</summary>
public sealed class BusinessRuleException(string key, params object?[] args) : AppException(key, args);

/// <summary>The requested record does not exist (HTTP 404).</summary>
public sealed class NotFoundException(string key, params object?[] args) : AppException(key, args);

/// <summary>Wrong credentials or an unusable account (HTTP 401).</summary>
public sealed class AuthenticationFailedException(string key, params object?[] args) : AppException(key, args);

/// <summary>The user is signed in but may not perform the action (HTTP 403).</summary>
public sealed class ForbiddenException(string key, params object?[] args) : AppException(key, args);
