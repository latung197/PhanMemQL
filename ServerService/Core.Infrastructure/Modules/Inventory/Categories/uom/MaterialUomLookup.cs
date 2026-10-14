using Core.Application.Common.Localization;
using Core.Application.Common.Lookups;
using Core.Infrastructure.Common.Lookups;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

/// <summary>
/// The units a voucher line may use for one material (<c>GET /api/lookups/materialUoms?material=VT001</c>): its base unit first
/// (extra <c>isBase</c>, <c>factor</c> 1) and then every unit converted to / from it, with <c>factor</c> = base units in one
/// unit (a conversion of the material wins over a general one, the same rule as the stock ledger). Without the parameter the
/// list is empty.
/// </summary>
public sealed class MaterialUomLookup(CoreContext db) : LookupProvider
{
    public override string Name => "materialUoms";

    public override IReadOnlyCollection<string> Tables => ["erp_material", "erp_uom", "erp_uom_translation", "erp_uom_conversion"];

    public override IReadOnlyCollection<string> ParameterNames => ["material"];

    public override async Task<IReadOnlyList<LookupItem>> LoadAsync(LookupContext context, CancellationToken ct)
    {
        if (context.Param("material")?.ToUpperInvariant() is not { } materialCode) return [];
        var material = await db.Materials.AsNoTracking().FirstOrDefaultAsync(x => x.Code == materialCode, ct);
        if (material is null) return [];

        var rows = await db.UomConversions.AsNoTracking()
            .Where(x => x.IsActive && x.Factor > 0 && (x.MaterialCode == null || x.MaterialCode == "" || x.MaterialCode == materialCode)
                && (x.FromUomCode == material.UomCode || x.ToUomCode == material.UomCode)).ToListAsync(ct);
        // One factor per unit: the conversion of the material over the general one.
        var factors = new Dictionary<string, decimal>(StringComparer.Ordinal);
        foreach (var c in rows.OrderBy(x => x.MaterialCode == materialCode ? 1 : 0))
        {
            if (c.ToUomCode == material.UomCode) factors[c.FromUomCode] = c.Factor;
            else factors[c.ToUomCode] = decimal.Round(1m / c.Factor, 8);
        }

        var codes = factors.Keys.Append(material.UomCode).Distinct().ToList();
        var units = await db.Uoms.AsNoTracking().Where(x => codes.Contains(x.Code) && x.IsActive).ToListAsync(ct);
        var translations = (await db.UomTranslations.AsNoTracking().Where(x => codes.Contains(x.UomCode)).ToListAsync(ct)).ToLookup(x => x.UomCode);
        var language = Messages.CurrentLanguage;
        var baseLanguage = language.Split('-')[0];
        string NameOf(Core.Domain.Modules.Inventory.Uom x) =>
            translations[x.Code].FirstOrDefault(t => t.LanguageCode == language)?.Name
            ?? translations[x.Code].FirstOrDefault(t => t.LanguageCode == baseLanguage)?.Name ?? x.Name;

        return units.OrderBy(x => x.Code == material.UomCode ? 0 : 1).ThenBy(x => x.SortOrder).ThenBy(x => x.Code)
            .Select(x => new LookupItem(x.Code, NameOf(x), true, new Dictionary<string, object?>
            {
                ["isBase"] = x.Code == material.UomCode,
                ["factor"] = x.Code == material.UomCode ? 1m : factors[x.Code],
                ["baseUom"] = material.UomCode
            })).ToList();
    }
}
