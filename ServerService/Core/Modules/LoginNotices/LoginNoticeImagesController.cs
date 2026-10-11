using Core.Application.Modules.LoginNotices;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.LoginNotices;

/// <summary>Uploads the pictures of the login notices (Settings › Thông báo trang đăng nhập). The picture is read by the open
/// GET /api/auth/notice-images/{code}.</summary>
[Route("api/settings/login-notice-images")]
public sealed class LoginNoticeImagesController(ILoginNoticeService notices) : ApiControllerBase
{
    /// <summary>The picture comes as base64 inside the JSON body (the browser has shrunk it first); the answer is its code.</summary>
    [HttpPost, RequirePermission("sys_login_notices", PermissionAction.Create)]
    public Task<LoginImageCodeDto> Upload(UploadLoginImageRequest request, CancellationToken ct) => notices.SaveImageAsync(request, ct);
}
