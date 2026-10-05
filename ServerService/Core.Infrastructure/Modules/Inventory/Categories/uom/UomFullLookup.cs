using Core.Application.Common.Localization;
using Core.Application.Common.Lookups;
using Core.Infrastructure.Common.Lookups;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Inventory;

/// <summary>
/// Tra cứu đơn vị tính đầy đủ (<c>GET /api/lookups/uomsFull</c>): every column of the unit catalog as typed extras
/// (the "select * from đơn vị tính" lookup), unlike the plain <c>uoms</c> lookup that has code, name and symbol only.
/// The model of a custom lookup (LookupProvider): it reads three tables, so it names all three; it takes the parameter
/// <c>convertibleTo=KG</c> and then lists only the units that have a conversion to or from KG (units to offer next to KG on a
/// voucher line).
/// </summary>
public sealed class UomFullLookup(CoreContext db) : LookupProvider
{
    public override string Name => "uomsFull";

    // The tables LoadAsync reads: the cached copy is dropped when one of them changes.
    public override IReadOnlyCollection<string> Tables => ["erp_uom", "erp_uom_translation", "erp_uom_conversion"];

    public override IReadOnlyCollection<string> ParameterNames => ["convertibleTo"];

    public override async Task<IReadOnlyList<LookupItem>> LoadAsync(LookupContext context, CancellationToken ct)
    {
        var units = db.Uoms.AsNoTracking();
        if (context.Param("convertibleTo")?.ToUpperInvariant() is { } other)
        {
            var linked = db.UomConversions.Where(c => c.FromUomCode == other || c.ToUomCode == other)
                .Select(c => c.FromUomCode == other ? c.ToUomCode : c.FromUomCode);
            units = units.Where(u => linked.Contains(u.Code));
        }
        var rows = await units.OrderBy(x => x.SortOrder).ThenBy(x => x.Code).ToListAsync(ct);

        // One query for the translations of all these units, not one per unit.
        var codes = rows.Select(x => x.Code).ToList();
        var translations = (await db.UomTranslations.AsNoTracking().Where(x => codes.Contains(x.UomCode)).ToListAsync(ct))
            .ToLookup(x => x.UomCode);
        var language = Messages.CurrentLanguage;
        var baseLanguage = language.Split('-')[0];

        return rows.Select(x =>
        {
            var name = translations[x.Code].FirstOrDefault(t => t.LanguageCode == language)?.Name
                ?? translations[x.Code].FirstOrDefault(t => t.LanguageCode == baseLanguage)?.Name ?? x.Name;
            return new LookupItem(x.Code, name, x.IsActive, new Dictionary<string, object?>
            {
                ["baseName"] = x.Name,
                ["symbol"] = x.Symbol,
                ["note"] = x.Note,
                ["sortOrder"] = x.SortOrder,
                ["createdAt"] = x.CreatedAt,
                ["updatedAt"] = x.UpdatedAt
            });
        }).ToList();
    }
}
