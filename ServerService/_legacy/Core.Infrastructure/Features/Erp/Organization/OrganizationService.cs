using Core.Application.Features.Erp.Organization;
using Core.Domain.Entity.Erp;
using Core.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Features.Erp.Organization;

public sealed class OrganizationService(CoreContext db) : IOrganizationService
{
    public async Task<IReadOnlyList<UnitDto>> GetUnitsAsync(CancellationToken ct) =>
        await db.ErpUnits.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new UnitDto(x.Code, x.Name, x.IsActive, x.SortOrder)).ToListAsync(ct);

    public async Task<IReadOnlyList<PlantDto>> GetPlantsAsync(CancellationToken ct) =>
        await db.ErpPlants.AsNoTracking().OrderBy(x => x.UnitCode).ThenBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new PlantDto(x.Code, x.UnitCode, x.Name, x.IsActive, x.SortOrder)).ToListAsync(ct);

    public async Task SaveUnitAsync(SaveUnitRequest request, CancellationToken ct)
    {
        ValidateCodeAndName(request.Code, request.Name);
        var entity = await db.ErpUnits.FindAsync([request.Code], ct);
        if (entity is null) db.ErpUnits.Add(entity = new OrganizationUnit { Code = request.Code });
        entity.Name = request.Name.Trim();
        entity.IsActive = request.IsActive;
        entity.SortOrder = request.SortOrder;
        await db.SaveChangesAsync(ct);
    }

    public async Task SavePlantAsync(SavePlantRequest request, CancellationToken ct)
    {
        ValidateCodeAndName(request.Code, request.Name);
        if (string.IsNullOrWhiteSpace(request.UnitCode) || request.UnitCode != request.UnitCode.Trim()
            || !await db.ErpUnits.AnyAsync(x => x.Code == request.UnitCode, ct))
            throw new ArgumentException("Đơn vị cơ sở không tồn tại.");
        var entity = await db.ErpPlants.FindAsync([request.Code], ct);
        if (entity is null) db.ErpPlants.Add(entity = new Plant { Code = request.Code, UnitCode = request.UnitCode });
        if (entity.UnitCode != request.UnitCode)
            throw new ArgumentException("Không thể chuyển nhà máy sang đơn vị khác; hãy tạo mã nhà máy mới.");
        entity.Name = request.Name.Trim();
        entity.IsActive = request.IsActive;
        entity.SortOrder = request.SortOrder;
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<PlantDto>> GetUserPlantsAsync(int userId, CancellationToken ct) =>
        await db.ErpUserPlants.AsNoTracking().Where(x => x.UserId == userId)
            .OrderBy(x => x.Plant.UnitCode).ThenBy(x => x.Plant.SortOrder)
            .Select(x => new PlantDto(x.PlantCode, x.Plant.UnitCode, x.Plant.Name,
                x.Plant.IsActive, x.Plant.SortOrder)).ToListAsync(ct);

    public async Task<IReadOnlyList<UnitDto>> GetUserUnitsAsync(int userId, CancellationToken ct) =>
        await db.ErpUserUnits.AsNoTracking().Where(x => x.UserId == userId)
            .OrderBy(x => x.Unit.SortOrder).ThenBy(x => x.UnitCode)
            .Select(x => new UnitDto(x.UnitCode, x.Unit.Name, x.Unit.IsActive,
                x.Unit.SortOrder)).ToListAsync(ct);

    public async Task SetUserUnitsAsync(int userId, IReadOnlyList<string> unitCodes, CancellationToken ct)
    {
        if (unitCodes is null) throw new ArgumentException("Danh sách đơn vị không hợp lệ.");
        if (!await db.SysUser.AnyAsync(x => x.UserId == userId && x.ValidFlg == 1, ct))
            throw new ArgumentException("Tài khoản không tồn tại.");
        var codes = unitCodes.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim())
            .Distinct(StringComparer.Ordinal).ToList();
        if (codes.Count != await db.ErpUnits.CountAsync(x => codes.Contains(x.Code) && x.IsActive, ct))
            throw new ArgumentException("Danh sách đơn vị có mã không tồn tại hoặc đã bị khóa.");
        var old = await db.ErpUserUnits.Where(x => x.UserId == userId).ToListAsync(ct);
        var existingCodes = old.Select(x => x.UnitCode).ToHashSet(StringComparer.Ordinal);
        db.ErpUserUnits.RemoveRange(old.Where(x => !codes.Contains(x.UnitCode, StringComparer.Ordinal)));
        db.ErpUserUnits.AddRange(codes.Where(code => !existingCodes.Contains(code))
            .Select(code => new UserUnitAccess { UserId = userId, UnitCode = code }));
        await db.SaveChangesAsync(ct);
    }

    public async Task SetUserPlantsAsync(int userId, IReadOnlyList<string> plantCodes, CancellationToken ct)
    {
        if (!await db.SysUser.AnyAsync(x => x.UserId == userId && x.ValidFlg == 1, ct))
            throw new ArgumentException("Tài khoản không tồn tại.");
        var codes = plantCodes.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim())
            .Distinct(StringComparer.Ordinal).ToList();
        if (codes.Count != await db.ErpPlants.CountAsync(x => codes.Contains(x.Code)
            && x.IsActive && x.Unit.IsActive, ct))
            throw new ArgumentException("Danh sách nhà máy có mã không tồn tại hoặc đã bị khóa.");
        var old = await db.ErpUserPlants.Where(x => x.UserId == userId).ToListAsync(ct);
        var existingCodes = old.Select(x => x.PlantCode).ToHashSet(StringComparer.Ordinal);
        db.ErpUserPlants.RemoveRange(old.Where(x => !codes.Contains(x.PlantCode, StringComparer.Ordinal)));
        db.ErpUserPlants.AddRange(codes.Where(code => !existingCodes.Contains(code))
            .Select(code => new UserPlantAccess { UserId = userId, PlantCode = code }));
        await db.SaveChangesAsync(ct);
    }

    private static void ValidateCodeAndName(string code, string name)
    {
        if (string.IsNullOrWhiteSpace(code) || code.Length > 20 || code != code.Trim()
            || code.Contains(':') || code.Contains(',') || code.Any(char.IsWhiteSpace)
            || string.IsNullOrWhiteSpace(name) || name.Length > 150)
            throw new ArgumentException("Mã hoặc tên không hợp lệ.");
    }
}
