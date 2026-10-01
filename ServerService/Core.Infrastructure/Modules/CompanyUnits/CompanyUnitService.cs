using Core.Application.Common.Exceptions;
using Core.Application.Common.Validation;
using Core.Application.Modules.CompanyUnits;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.SystemConfig;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.CompanyUnits;

public sealed class CompanyUnitService(CoreContext db) : ICompanyUnitService
{
    public async Task<IReadOnlyList<CompanyUnitDto>> GetAllAsync(bool activeOnly, CancellationToken ct)
    {
        var query = db.CompanyUnits.AsNoTracking();
        if (activeOnly) query = query.Where(x => x.IsActive);
        var units = await query.OrderBy(x => x.SortOrder).ThenBy(x => x.Code).ToListAsync(ct);
        return units.Select(ToDto).ToList();
    }

    public async Task<CompanyUnitDto> CreateAsync(SaveCompanyUnitRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 20, "field.unitCode");
        if (await db.CompanyUnits.AnyAsync(x => x.Code == code, ct))
            throw new BusinessRuleException("companyUnit.codeExists", code);
        var unit = new CompanyUnit
        {
            Code = code,
            SortOrder = (await db.CompanyUnits.MaxAsync(x => (int?)x.SortOrder, ct) ?? 0) + 1
        };
        Apply(unit, request);
        db.CompanyUnits.Add(unit);
        await ApplyDefaultAsync(unit, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(unit);
    }

    /// <summary>The code is the key and cannot be changed; the request code is ignored.</summary>
    public async Task<CompanyUnitDto> UpdateAsync(string code, SaveCompanyUnitRequest request, CancellationToken ct)
    {
        var unit = await FindAsync(code, ct);
        Apply(unit, request);
        if (!unit.IsActive) await EnsureAnotherActiveAsync(unit.Code, ct);
        await ApplyDefaultAsync(unit, ct);
        await db.SaveChangesAsync(ct);
        return ToDto(unit);
    }

    public async Task DeleteAsync(string code, CancellationToken ct)
    {
        var unit = await FindAsync(code, ct);
        var scope = SystemSetting.UnitScope(unit.Code);
        if (await db.UserCompanyUnits.AnyAsync(x => x.UnitCode == unit.Code, ct)
            || await db.Users.AnyAsync(x => x.ValidFlg == 1 && x.MaDvcs == unit.Code, ct)
            || await db.SystemSettings.AnyAsync(x => x.Scope == scope, ct))
            throw new BusinessRuleException(
                "companyUnit.inUse");
        await EnsureAnotherActiveAsync(unit.Code, ct);
        // No foreign keys in the database, so every table that links to a unit is checked above.
        db.CompanyUnits.Remove(unit);
        await db.SaveChangesAsync(ct);
    }

    private async Task<CompanyUnit> FindAsync(string code, CancellationToken ct) =>
        await db.CompanyUnits.FirstOrDefaultAsync(x => x.Code == code, ct)
        ?? throw new NotFoundException("companyUnit.notFound");

    private static void Apply(CompanyUnit unit, SaveCompanyUnitRequest request)
    {
        unit.Name = Guard.Required(request.Name, 150, "field.unitName");
        unit.ShortName = Guard.Optional(request.ShortName, 100, "field.shortName");
        unit.Address = Guard.Optional(request.Address, 300, "field.address");
        unit.Phone = Guard.Optional(request.Phone, 30, "field.phone");
        unit.Email = Guard.Optional(request.Email, 150, "field.email");
        unit.TaxCode = Guard.Optional(request.TaxCode, 30, "field.taxCode");
        unit.IsActive = request.Status != CompanyUnitStatus.Paused;
        unit.IsDefault = request.IsDefault && unit.IsActive;
    }

    /// <summary>At most one unit is the default.</summary>
    private async Task ApplyDefaultAsync(CompanyUnit unit, CancellationToken ct)
    {
        if (!unit.IsDefault) return;
        await foreach (var other in db.CompanyUnits.Where(x => x.IsDefault && x.Code != unit.Code)
                           .AsAsyncEnumerable().WithCancellation(ct))
            other.IsDefault = false;
    }

    private async Task EnsureAnotherActiveAsync(string code, CancellationToken ct)
    {
        if (!await db.CompanyUnits.AnyAsync(x => x.Code != code && x.IsActive, ct))
            throw new BusinessRuleException("companyUnit.lastActive");
    }

    private static CompanyUnitDto ToDto(CompanyUnit x) => new(x.Code, x.Code, x.Name, x.ShortName, x.Address,
        x.Phone, x.Email, x.TaxCode, x.IsActive ? CompanyUnitStatus.Active : CompanyUnitStatus.Paused, x.IsDefault);
}
