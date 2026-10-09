using Core.Application.Modules.Departments;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Departments;

/// <summary>Settings › Danh mục phòng ban. The endpoints come from CatalogControllerBase; user forms and approval rules
/// pick departments with the lookup (GET /api/lookups/departments).</summary>
[Route("api/settings/departments")]
[CatalogFunction("sys_departments")]
public sealed class DepartmentsController(IDepartmentService departments, IPermissionService permissions)
    : CatalogControllerBase<DepartmentDto, SaveDepartmentRequest>(departments, permissions);
