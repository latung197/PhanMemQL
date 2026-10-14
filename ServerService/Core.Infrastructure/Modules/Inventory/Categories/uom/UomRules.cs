using Core.Application.Common.Exceptions;
using Core.Domain.Modules.Inventory;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

/// <summary>Which units a voucher line may use for a material: its base unit, or a unit that has a conversion with it.</summary>
public static class UomRules
{
    /// <summary>
    /// Throws <c>stock.uomNotConvertible</c> when <paramref name="uomCode"/> is neither the base unit of the material nor a unit
    /// converted to / from it (a conversion of the material or a general one, active), so a voucher is refused when it is saved
    /// and not only when the stock ledger posts it (the same rule as <c>StockLedgerService</c>).
    /// </summary>
    public static async Task EnsureUsableAsync(CoreContext db, Material material, string uomCode, CancellationToken ct)
    {
        var line = (uomCode ?? string.Empty).Trim().ToUpperInvariant();
        if (line.Length == 0 || line == material.UomCode) return;
        var found = await db.UomConversions.AsNoTracking().AnyAsync(x => x.IsActive && x.Factor > 0
            && (x.MaterialCode == null || x.MaterialCode == "" || x.MaterialCode == material.Code)
            && ((x.FromUomCode == line && x.ToUomCode == material.UomCode) || (x.FromUomCode == material.UomCode && x.ToUomCode == line)), ct);
        if (!found) throw new BusinessRuleException("stock.uomNotConvertible", line, material.UomCode, material.Code);
    }
}
