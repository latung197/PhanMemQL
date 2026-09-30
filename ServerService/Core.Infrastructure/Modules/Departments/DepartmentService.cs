using Core.Application.Common.Exceptions;
using Core.Application.Common.Validation;
using Core.Application.Modules.Departments;
using Core.Domain.Modules.Approvals;
using Core.Domain.Modules.Departments;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Departments;

/// <summary>Danh mục phòng ban: a plain catalog (code + name) and the model for new catalogs.</summary>
public sealed class DepartmentService(CoreContext db) : IDepartmentService
{
    public async Task<IReadOnlyList<DepartmentDto>> GetAllAsync(CancellationToken ct)
    {
        var departments = await db.Departments.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToListAsync(ct);
        var counts = await db.Users.AsNoTracking().Where(x => x.ValidFlg == 1 && x.DepartmentCode != null)
            .GroupBy(x => x.DepartmentCode!).Select(g => new { Code = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Code, x => x.Count, ct);
        return departments.Select(x => ToDto(x, counts.GetValueOrDefault(x.Code))).ToList();
    }

    public async Task<DepartmentDto> CreateAsync(SaveDepartmentRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 20, "Mã phòng ban");
        if (await db.Departments.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException($"Mã phòng ban {code} đã tồn tại.");
        var department = new Department
        {
            Code = code,
            SortOrder = (await db.Departments.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1
        };
        await ApplyAsync(department, request, ct);
        db.Departments.Add(department);
        await db.SaveChangesAsync(ct);
        return ToDto(department, 0);
    }

    public async Task<DepartmentDto> UpdateAsync(string code, SaveDepartmentRequest request, CancellationToken ct)
    {
        var department = await FindAsync(code, ct);
        await ApplyAsync(department, request, ct);
        await db.SaveChangesAsync(ct);
        // Users keep the department name next to the code; copy a renamed department to them.
        await db.Users.Where(x => x.DepartmentCode == department.Code && x.Department != department.Name)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Department, department.Name), ct);
        var users = await db.Users.CountAsync(x => x.ValidFlg == 1 && x.DepartmentCode == department.Code, ct);
        return ToDto(department, users);
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        var department = await FindAsync(code, ct);
        // No foreign keys: check every table that refers to a department.
        var users = await db.Users.CountAsync(x => x.ValidFlg == 1 && x.DepartmentCode == department.Code, ct);
        if (users > 0)
            throw new BusinessRuleException(
                $"Phòng ban \"{department.Name}\" đang có {users} người dùng. Hãy chuyển họ sang phòng khác hoặc đặt phòng ban ngừng sử dụng.");
        if (await db.ApprovalRules.AnyAsync(x => x.RequesterType == RequesterTypes.Department && x.RequesterValue == department.Code, ct))
            throw new BusinessRuleException($"Phòng ban \"{department.Name}\" đang được dùng trong quy trình phê duyệt.");
        db.Departments.Remove(department);
        await db.SaveChangesAsync(ct);
    }

    private async Task<Department> FindAsync(string code, CancellationToken ct) =>
        await db.Departments.FirstOrDefaultAsync(x => x.Code == code, ct)
        ?? throw new NotFoundException("Phòng ban không tồn tại.");

    private async Task ApplyAsync(Department department, SaveDepartmentRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 100, "tên phòng ban");
        if (await db.Departments.AnyAsync(x => x.Code != department.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException($"Tên phòng ban \"{name}\" đã tồn tại.");
        department.Name = name;
        department.Note = Guard.Optional(request.Note, 300, "Ghi chú");
        department.IsActive = request.IsActive;
    }

    private static DepartmentDto ToDto(Department x, int userCount) =>
        new(x.Code, x.Name, x.Note, x.IsActive, userCount);
}
