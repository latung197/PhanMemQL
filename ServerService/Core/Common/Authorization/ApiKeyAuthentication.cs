using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using Core.Application.Common.Localization;
using Core.Application.Common.Security;
using Core.Application.Modules.ApiClients;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Core.Common.Authorization;

/// <summary>
/// The second way to sign in: an API key in the header <c>X-Api-Key</c> (docs/he-thong/tich-hop-api-key.md). A valid key becomes
/// a principal with the same claims a token carries (the service account, the unit of the client, its security version), so every
/// check after it (unit access, rights, status rights, audit, month locks) runs unchanged; two extra claims name the client and its scope.
/// </summary>
public sealed class ApiKeyAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder, IApiClientService clients)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string Scheme = "ApiKey";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(ApiKeyRules.Header, out var values)) return AuthenticateResult.NoResult();
        var ip = Context.Connection.RemoteIpAddress?.ToString();
        var (identity, failure) = await clients.ValidateAsync(values.ToString(), ip, Context.RequestAborted);
        if (identity is null)
        {
            Logger.LogWarning("API key refused ({Failure}) from {Ip}", failure, ip);
            return AuthenticateResult.Fail(failure.ToString());
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, identity.UserId.ToString()),
            new Claim(ErpClaimTypes.UserName, identity.UserName),
            new Claim(ErpClaimTypes.UnitCode, identity.UnitCode),
            new Claim(ErpClaimTypes.SecurityVersion, identity.SecurityVersion.ToString()),
            new Claim(ErpClaimTypes.SessionId, "apikey:" + identity.ClientCode),
            new Claim(ErpClaimTypes.ApiClient, identity.ClientCode),
            new Claim(ErpClaimTypes.ApiScope, identity.Scope)
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme, ErpClaimTypes.UserName, ClaimTypes.Role));
        return AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme));
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Response.WriteAsJsonAsync(new { message = Messages.T("apiClient.keyRefused") });
    }
}

/// <summary>
/// After authentication: a request signed with an API key may only reach the APIs of its scope (<see cref="ApiKeyRules.Allows"/>);
/// anything else is 403, whatever rights the account behind the key has. Then the Idempotency-Key header (POST only) makes a
/// request that is sent again do its work once: the stored reply is returned instead.
/// </summary>
public sealed class ApiClientMiddleware(RequestDelegate next)
{
    private const long MaxBodyToHash = 1_048_576;

    public async Task InvokeAsync(HttpContext context, IIdempotencyStore store, ApiKeyRateLimit rateLimit, IConfiguration configuration)
    {
        var client = context.User.FindFirstValue(ErpClaimTypes.ApiClient);
        if (client is null)
        {
            await next(context);
            return;
        }

        var scope = context.User.FindFirstValue(ErpClaimTypes.ApiScope) ?? string.Empty;
        if (!ApiKeyRules.Allows(scope, context.Request.Method, context.Request.Path.Value ?? string.Empty))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { message = Messages.T("apiClient.outOfScope") });
            return;
        }

        // A limit per key (calls a minute, ApiKeys:RequestsPerMinute, 0 = off): a robot stuck in a loop cannot flood the system.
        if (!rateLimit.TryAcquire(client, configuration.GetValue("ApiKeys:RequestsPerMinute", 600), DateTime.UtcNow, out var retryAfter))
        {
            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            context.Response.Headers.RetryAfter = retryAfter.ToString(System.Globalization.CultureInfo.InvariantCulture);
            await context.Response.WriteAsJsonAsync(new { message = Messages.T("apiClient.tooManyRequests", retryAfter) });
            return;
        }

        var key = context.Request.Headers[ApiKeyRules.IdempotencyHeader].ToString().Trim();
        if (key.Length == 0 || !HttpMethods.IsPost(context.Request.Method))
        {
            await next(context);
            return;
        }
        if (key.Length > 200)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new { message = Messages.T("apiClient.idempotencyKeyLong") });
            return;
        }

        // The same key with another request (other path or body) is a mistake of the caller, not a retry.
        var hash = await RequestHashAsync(context.Request);
        var (result, reply) = await store.BeginAsync(client, key, hash, context.RequestAborted);
        switch (result)
        {
            case IdempotencyStart.Replay:
                context.Response.StatusCode = reply!.Status;
                context.Response.Headers["Idempotency-Replayed"] = "true";
                if (reply.ContentType is not null) context.Response.ContentType = reply.ContentType;
                if (reply.Body is not null) await context.Response.WriteAsync(reply.Body);
                return;
            case IdempotencyStart.DifferentRequest:
                context.Response.StatusCode = StatusCodes.Status422UnprocessableEntity;
                await context.Response.WriteAsJsonAsync(new { message = Messages.T("apiClient.idempotencyReused") });
                return;
            case IdempotencyStart.Busy:
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                await context.Response.WriteAsJsonAsync(new { message = Messages.T("apiClient.idempotencyBusy") });
                return;
        }

        // Started: run the request while keeping a copy of the reply to store.
        var original = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;
        try
        {
            await next(context);
            buffer.Position = 0;
            var body = await new StreamReader(buffer).ReadToEndAsync();
            // A server error is not a reply to keep: the retry must be able to run.
            if (context.Response.StatusCode >= 500) await store.AbandonAsync(client, key, CancellationToken.None);
            else await store.CompleteAsync(client, key, new StoredReply(context.Response.StatusCode, context.Response.ContentType, body), CancellationToken.None);
            buffer.Position = 0;
            context.Response.Body = original;
            await buffer.CopyToAsync(original, context.RequestAborted);
        }
        catch
        {
            context.Response.Body = original;
            await store.AbandonAsync(client, key, CancellationToken.None);
            throw;
        }
    }

    private static async Task<string> RequestHashAsync(HttpRequest request)
    {
        request.EnableBuffering();
        string body;
        using (var reader = new StreamReader(request.Body, leaveOpen: true))
        {
            var text = await reader.ReadToEndAsync();
            body = request.ContentLength is > MaxBodyToHash ? text[..(int)MaxBodyToHash] : text;
        }
        request.Body.Position = 0;
        return ApiKeyRules.Hash($"{request.Method} {request.Path}{request.QueryString}\n{body}");
    }
}
