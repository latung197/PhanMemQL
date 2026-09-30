namespace Core.Application.Common.Exceptions;

/// <summary>
/// Errors raised by services. The API maps them to HTTP status codes and returns
/// <c>{ message }</c>, so messages are written for the end user (Vietnamese).
/// </summary>
public abstract class AppException(string message) : Exception(message);

/// <summary>Invalid input or a violated business rule (HTTP 400).</summary>
public sealed class BusinessRuleException(string message) : AppException(message);

/// <summary>The requested record does not exist (HTTP 404).</summary>
public sealed class NotFoundException(string message) : AppException(message);

/// <summary>Wrong credentials or an unusable account (HTTP 401).</summary>
public sealed class AuthenticationFailedException(string message) : AppException(message);

/// <summary>The user is signed in but may not perform the action (HTTP 403).</summary>
public sealed class ForbiddenException(string message) : AppException(message);
