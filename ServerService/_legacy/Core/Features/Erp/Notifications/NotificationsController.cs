using System.Security.Claims;
using Core.Application.Features.Erp.Auth;
using Core.Application.Features.Erp.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Core.Features.Erp.Notifications;

[ApiController]
[Route("api/erp/notifications")]
[Authorize]
public sealed class NotificationsController(INotificationService service) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "ErpContext")]
    public Task<IReadOnlyList<NotificationDto>> Inbox([FromQuery] bool unreadOnly,
        CancellationToken ct) => service.GetInboxAsync(UserId, UnitCode, PlantCode, unreadOnly, ct);

    [HttpPut("{id:long}/read")]
    [Authorize(Policy = "ErpContext")]
    public async Task<IActionResult> MarkRead(long id, CancellationToken ct) =>
        await service.MarkReadAsync(UserId, UnitCode, PlantCode, id, ct) ? NoContent() : NotFound();

    [HttpPut("read-all")]
    [Authorize(Policy = "ErpContext")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct) =>
        Ok(new { count = await service.MarkAllReadAsync(UserId, UnitCode, PlantCode, ct) });

    [HttpPost]
    [Authorize(Policy = "AccessAdmin")]
    public async Task<IActionResult> Publish(PublishNotificationRequest request, CancellationToken ct)
    {
        try { return Ok(new { id = await service.PublishAsync(UserId, request, ct) }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string UnitCode => User.FindFirstValue(ErpClaimTypes.UnitCode)!;
    private string? PlantCode => User.FindFirstValue(ErpClaimTypes.PlantCode);
}
