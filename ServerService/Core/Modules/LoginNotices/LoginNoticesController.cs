using Core.Application.Modules.LoginNotices;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.LoginNotices;

/// <summary>Settings › Thông báo trang đăng nhập. The endpoints come from CatalogControllerBase; the login screen reads the
/// notices in force from the anonymous GET /api/auth/notices.</summary>
[Route("api/settings/login-notices")]
[CatalogFunction("sys_login_notices")]
public sealed class LoginNoticesController(ILoginNoticeService notices, IPermissionService permissions)
    : CatalogControllerBase<LoginNoticeDto, SaveLoginNoticeRequest>(notices, permissions);
