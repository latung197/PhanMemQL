using System.Security.Claims;
using Core.Application.Common.Security;
using Core.Application.Modules.Notifications;
using Core.Application.Modules.Users;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Notifications;

/// <summary>Header notification bell (Frontend components/layout/NotificationDropdown).</summary>
[Route("api/notifications")]
public sealed class NotificationsController(INotificationService notifications) : ApiControllerBase
{
    private static readonly TimeSpan Heartbeat = TimeSpan.FromSeconds(25);

    /// <summary>
    /// Server-sent events: "notification" when something new arrives for this user and unit, "sync" when
    /// another tab changed the read state. The browser reads it with fetch() so the token stays in the
    /// Authorization header. A comment line every 25 s keeps proxies from closing the connection; the
    /// stream also ends as soon as the token is revoked (account locked, password changed).
    /// </summary>
    [HttpGet("stream")]
    public async Task Stream([FromServices] INotificationStream stream, [FromServices] IPermissionService permissions)
    {
        var ct = HttpContext.RequestAborted;
        int.TryParse(User.FindFirstValue(ErpClaimTypes.SecurityVersion), out var securityVersion);
        Response.Headers.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        using var subscription = stream.Subscribe(CurrentUserId, CurrentUnitCode);
        await WriteAsync(": connected\n\n", ct);
        try
        {
            while (!ct.IsCancellationRequested)
            {
                using var wait = CancellationTokenSource.CreateLinkedTokenSource(ct);
                wait.CancelAfter(Heartbeat);
                try
                {
                    if (!await subscription.Events.WaitToReadAsync(wait.Token)) break;
                    while (subscription.Events.TryRead(out var name)) await WriteAsync($"event: {name}\ndata: {{}}\n\n", ct);
                }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested)
                {
                    if (!await permissions.IsTokenCurrentAsync(CurrentUserId, securityVersion, ct)) break;
                    await WriteAsync(": ping\n\n", ct);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Browser tab closed.
        }
    }

    private async Task WriteAsync(string text, CancellationToken ct)
    {
        await Response.WriteAsync(text, ct);
        await Response.Body.FlushAsync(ct);
    }

    [HttpGet]
    public Task<IReadOnlyList<NotificationDto>> Inbox(CancellationToken ct) =>
        notifications.GetInboxAsync(CurrentUserId, CurrentUnitCode, ct);

    [HttpPut("{id:long}/read")]
    public async Task<IActionResult> MarkRead(long id, CancellationToken ct)
    {
        await notifications.MarkReadAsync(CurrentUserId, CurrentUnitCode, id, ct);
        return NoContent();
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct) =>
        Ok(new { count = await notifications.MarkAllReadAsync(CurrentUserId, CurrentUnitCode, ct) });

    /// <summary>Hides one notification from this user's inbox only.</summary>
    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Dismiss(long id, CancellationToken ct)
    {
        await notifications.DismissAsync(CurrentUserId, CurrentUnitCode, id, ct);
        return NoContent();
    }

    /// <summary>"Xóa tất cả": hides the notifications from this user's inbox only.</summary>
    [HttpDelete]
    public async Task<IActionResult> DismissAll(CancellationToken ct) =>
        Ok(new { count = await notifications.DismissAllAsync(CurrentUserId, CurrentUnitCode, ct) });

    /// <summary>Rights checked in the service: SEND_NOTIFICATION (own unit) / SEND_NOTIFICATION_ALL / admin.</summary>
    [HttpPost]
    public Task<NotificationDto> Publish(PublishNotificationRequest request, CancellationToken ct) =>
        notifications.SendAsync(CurrentUserId, CurrentUnitCode, request, ct);

    [HttpGet("send-scope")]
    public Task<NotificationSendScope> SendScope(CancellationToken ct) =>
        notifications.GetSendScopeAsync(CurrentUserId, CurrentUnitCode, ct);

    [HttpGet("recipients")]
    public Task<IReadOnlyList<NotificationRecipientDto>> Recipients([FromQuery] string? unitCode, CancellationToken ct) =>
        notifications.GetRecipientsAsync(CurrentUserId, CurrentUnitCode, unitCode, ct);
}
