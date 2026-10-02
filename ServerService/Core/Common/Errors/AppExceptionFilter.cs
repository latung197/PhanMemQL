using Core.Application.Common.Exceptions;
using Core.Infrastructure.Common.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Core.Common.Errors;

/// <summary>
/// Maps service exceptions to status codes with a <c>{ message }</c> body the frontend shows; database errors a user
/// can cause (duplicate value, two saves colliding) become 409 with a readable message (DatabaseErrors).
/// </summary>
public sealed class AppExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if ((context.Exception as AppException ?? DatabaseErrors.Translate(context.Exception)) is not { } exception) return;
        context.Result = ErrorResponse.Create(exception switch
        {
            NotFoundException => StatusCodes.Status404NotFound,
            AuthenticationFailedException => StatusCodes.Status401Unauthorized,
            ForbiddenException => StatusCodes.Status403Forbidden,
            ConflictException => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        }, exception.Message);
        context.ExceptionHandled = true;
    }
}

public static class ErrorResponse
{
    public static ObjectResult Create(int statusCode, string message) =>
        new(new { message }) { StatusCode = statusCode };
}
