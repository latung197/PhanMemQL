using Core.Application.Modules.Departments;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.Departments;

/// <summary>Settings › Danh mục phòng ban (function sys_departments).</summary>
[Route("api/settings/departments")]
public sealed class DepartmentsController(IDepartmentService departments) : ApiControllerBase
{
    private const string Function = "sys_departments";

    /// <summary>For every signed-in user: user forms and approval rules pick departments from it.</summary>
    [HttpGet]
    public Task<IReadOnlyList<DepartmentDto>> GetAll(CancellationToken ct) => departments.GetAllAsync(ct);

    [HttpPost, RequirePermission(Function, PermissionAction.Create)]
    public Task<DepartmentDto> Create(SaveDepartmentRequest request, CancellationToken ct) =>
        departments.CreateAsync(request, ct);

    [HttpPut("{code}"), RequirePermission(Function, PermissionAction.Edit)]
    public Task<DepartmentDto> Update(string code, SaveDepartmentRequest request, CancellationToken ct) =>
        departments.UpdateAsync(code, request, ct);

    [HttpDelete("{code}"), RequirePermission(Function, PermissionAction.Delete)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await departments.DeleteAsync(code, ct);
        return NoContent();
    }
}
