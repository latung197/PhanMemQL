using Core.Application.Common.Auditing;
using Core.Application.Common.Exceptions;
using Core.Application.Modules.Production;
using Core.Application.Common.Paging;
using Core.Domain.Modules.Inventory;
using Core.Domain.Modules.Production;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Common.References;
using Core.Infrastructure.Modules.Inventory;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Production;

/// <summary>
/// Cấu trúc sản phẩm (BOM): one structure per product with its ordered component lines. Saving replaces the lines in place (the key of a line
/// is the product and its place), in the same transaction as the header and the change log. A structure may not contain its own product,
/// directly or through the structures of its components.
/// </summary>
public sealed class ProductStructureService(CoreContext db, IAuditLog audit) : IProductStructureService
{
    private sealed class Row
    {
        public string MaterialCode { get; set; } = "";
        public string MaterialName { get; set; } = "";
        public string UomCode { get; set; } = "";
        public int LineCount { get; set; }
        public bool HasChildren { get; set; }
        public bool IsActive { get; set; }
    }

    private static readonly SortMap<Row> SortColumns = SortMap<Row>.By(x => x.MaterialCode, "code")
        .Add("code", x => x.MaterialCode).Add("name", x => x.MaterialName).Add("lineCount", x => x.LineCount).Add("isActive", x => x.IsActive);

    public async Task<PagedResult<ProductStructureListItemDto>> ListAsync(ProductStructureListQuery query, CancellationToken ct)
    {
        var rows = db.ProductStructures.AsNoTracking()
            .Join(db.Materials.AsNoTracking(), s => s.Code, m => m.Code, (s, m) => new Row
            {
                MaterialCode = s.Code, MaterialName = m.Name, UomCode = m.UomCode, IsActive = s.IsActive,
                LineCount = db.ProductStructureLines.Count(l => l.ProductStructureCode == s.Code),
                HasChildren = db.ProductStructureLines.Any(l => l.ProductStructureCode == s.Code
                    && db.ProductStructures.Any(c => c.Code == l.ComponentMaterialCode))
            });

        var status = (query.Status ?? string.Empty).Trim().ToLowerInvariant();
        if (status == "active") rows = rows.Where(x => x.IsActive);
        else if (status == "inactive") rows = rows.Where(x => !x.IsActive);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = PagingExtensions.ContainsPattern(query.Search);
            if (string.Equals(query.Mode, "parent", StringComparison.OrdinalIgnoreCase))
                // Tìm mẹ - con: the products that contain a material matching the text as a component.
                rows = rows.Where(x => db.ProductStructureLines.Any(l => l.ProductStructureCode == x.MaterialCode
                    && (SearchFunctions.Matches(l.ComponentMaterialCode, pattern)
                        || db.Materials.Any(m => m.Code == l.ComponentMaterialCode && SearchFunctions.Matches(m.Name, pattern)))));
            else
                rows = rows.Where(x => SearchFunctions.Matches(x.MaterialCode, pattern) || SearchFunctions.Matches(x.MaterialName, pattern));
        }

        var page = await rows.ToPagedAsync(query, SortColumns, ct);
        return new PagedResult<ProductStructureListItemDto>(
            page.Items.Select(x => new ProductStructureListItemDto(x.MaterialCode, x.MaterialName, x.UomCode, x.LineCount, x.HasChildren, x.IsActive)).ToList(),
            page.Total, page.Page, page.PageSize);
    }

    public async Task<ProductStructureDto> GetAsync(string materialCode, CancellationToken ct)
    {
        var code = Code(materialCode);
        var row = await db.ProductStructures.AsNoTracking().FirstOrDefaultAsync(x => x.Code == code, ct)
            ?? throw new NotFoundException("productStructure.notFound");
        return await ToDtoAsync(row, ct);
    }

    public async Task<ProductStructureDto> CreateAsync(SaveProductStructureRequest request, CancellationToken ct)
    {
        var code = Code(request.MaterialCode);
        if (await db.ProductStructures.AnyAsync(x => x.Code == code, ct)) throw new BusinessRuleException("productStructure.exists", code);
        var product = await db.Materials.AsNoTracking().FirstOrDefaultAsync(x => x.Code == code && x.IsActive, ct)
            ?? throw new BusinessRuleException("productStructure.productInvalid", code);
        var row = new ProductStructure { Code = product.Code, MaterialCode = product.Code };
        await ApplyAsync(row, request, [], ct);
        db.ProductStructures.Add(row);
        await db.EnsureReferencesExistAsync(row, ct);
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(row, ct);
    }

    public async Task<ProductStructureDto> UpdateAsync(string materialCode, SaveProductStructureRequest request, CancellationToken ct)
    {
        var code = Code(materialCode);
        var row = await db.ProductStructures.FirstOrDefaultAsync(x => x.Code == code, ct)
            ?? throw new NotFoundException("productStructure.notFound");
        // A lines-only edit must still advance the version, so touch the header.
        db.ExpectVersion(row, request.Version, touch: true);
        var existing = (await db.ProductStructureLines.Where(x => x.ProductStructureCode == code).ToListAsync(ct)).OrderBy(x => x.LineNo).ToList();
        await ApplyAsync(row, request, existing, ct);
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(row, ct);
    }

    public async Task DeleteAsync(string materialCode, CancellationToken ct)
    {
        var code = Code(materialCode);
        var row = await db.ProductStructures.FirstOrDefaultAsync(x => x.Code == code, ct)
            ?? throw new NotFoundException("productStructure.notFound");
        db.ProductStructureLines.RemoveRange(await db.ProductStructureLines.Where(x => x.ProductStructureCode == code).ToListAsync(ct));
        db.ProductStructures.Remove(row);
        await db.SaveChangesAsync(ct);
    }

    private async Task ApplyAsync(ProductStructure row, SaveProductStructureRequest request, List<ProductStructureLine> existing, CancellationToken ct)
    {
        if (request.Lines is null || request.Lines.Count == 0) throw new BusinessRuleException("productStructure.noLines");

        var codes = request.Lines.Select(x => Code(x.ComponentMaterialCode)).ToList();
        var materials = await db.Materials.AsNoTracking().Where(x => codes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, ct);
        var operationCodes = request.Lines.Select(x => Code(x.ProductionOperationCode)).Where(x => x.Length > 0).Distinct().ToList();
        var operations = await db.ProductionOperations.AsNoTracking().Where(x => operationCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, ct);

        var wanted = new List<(string Component, string Uom, string? Operation, decimal Quantity, decimal Scrap, string? Note)>();
        for (var i = 0; i < request.Lines.Count; i++)
        {
            var line = request.Lines[i];
            var component = codes[i];
            if (component == row.Code) throw new BusinessRuleException("productStructure.selfComponent", component);
            // A component already on the structure may keep an ended material; a new one must be in use.
            var kept = existing.Any(x => x.ComponentMaterialCode == component);
            if (!materials.TryGetValue(component, out var material) || (!material.IsActive && !kept))
                throw new BusinessRuleException("productStructure.componentInvalid", component);
            if (line.Quantity <= 0 || decimal.Round(line.Quantity, 4) != line.Quantity || line.Quantity >= 1_000_000_000_000m)
                throw new BusinessRuleException("productStructure.quantityInvalid", component);
            if (line.ScrapPercent < 0 || line.ScrapPercent >= 100 || decimal.Round(line.ScrapPercent, 4) != line.ScrapPercent)
                throw new BusinessRuleException("productStructure.scrapInvalid", component);
            var uom = Code(line.UomCode);
            if (uom.Length == 0) uom = material.UomCode;
            await UomRules.EnsureUsableAsync(db, material, uom, ct);
            var operation = Code(line.ProductionOperationCode);
            if (operation.Length > 0)
            {
                var old = existing.Any(x => x.ProductionOperationCode == operation);
                if (!operations.TryGetValue(operation, out var op) || (!op.IsActive && !old))
                    throw new BusinessRuleException("productStructure.operationInvalid", operation);
            }
            wanted.Add((component, uom, operation.Length == 0 ? null : operation, line.Quantity, line.ScrapPercent,
                string.IsNullOrWhiteSpace(line.Note) ? null : line.Note.Trim()));
            if (wanted[^1].Note is { Length: > 300 }) throw new BusinessRuleException("productStructure.noteTooLong");
        }
        if (request.Note is { Length: > 300 }) throw new BusinessRuleException("productStructure.noteTooLong");
        await EnsureNoCycleAsync(row.Code, codes, ct);

        row.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        row.IsActive = request.IsActive;

        // The lines are edited in place, so the change log gets them as one field: "CODE quantity unit (operation, scrap%)" per line.
        static string Summary(string component, decimal quantity, string uom, string? operation, decimal scrap) =>
            $"{component} {quantity:0.####} {uom}" + (operation is null && scrap == 0 ? "" : $" ({operation}{(scrap == 0 ? "" : $" {scrap:0.####}%")})");
        var before = string.Join("; ", existing.Select(x => Summary(x.ComponentMaterialCode, x.Quantity, x.UomCode, x.ProductionOperationCode, x.ScrapPercent)));
        var after = string.Join("; ", wanted.Select(w => Summary(w.Component, w.Quantity, w.Uom, w.Operation, w.Scrap)));
        if (before != after) audit.Attach(row, [new AuditChange("components", existing.Count == 0 ? null : before, after)]);

        // Rows keep their place: change them in place, add the new tail, drop the old one.
        for (var i = 0; i < wanted.Count; i++)
        {
            var w = wanted[i];
            var line = i < existing.Count ? existing[i] : db.ProductStructureLines.Add(new ProductStructureLine { ProductStructureCode = row.Code, LineNo = i + 1 }).Entity;
            line.ComponentMaterialCode = w.Component;
            line.UomCode = w.Uom;
            line.ProductionOperationCode = w.Operation;
            line.Quantity = w.Quantity;
            line.ScrapPercent = w.Scrap;
            line.Note = w.Note;
        }
        if (existing.Count > wanted.Count) db.ProductStructureLines.RemoveRange(existing.Skip(wanted.Count));
    }

    /// <summary>Walks down the structures of the components: reaching the product again means the new structure would contain itself.</summary>
    private async Task EnsureNoCycleAsync(string product, IReadOnlyList<string> components, CancellationToken ct)
    {
        var seen = new HashSet<string>(components, StringComparer.Ordinal);
        var frontier = seen.ToList();
        while (frontier.Count > 0)
        {
            var next = (await db.ProductStructureLines.AsNoTracking().Where(l => frontier.Contains(l.ProductStructureCode) && l.ProductStructureCode != product)
                .Select(l => l.ComponentMaterialCode).Distinct().ToListAsync(ct)).Where(seen.Add).ToList();
            if (next.Contains(product)) throw new BusinessRuleException("productStructure.cycle", product);
            frontier = next;
        }
    }

    private async Task<ProductStructureDto> ToDtoAsync(ProductStructure row, CancellationToken ct)
    {
        var product = await db.Materials.AsNoTracking().FirstOrDefaultAsync(x => x.Code == row.Code, ct);
        var lines = await db.ProductStructureLines.AsNoTracking().Where(x => x.ProductStructureCode == row.Code).OrderBy(x => x.LineNo).ToListAsync(ct);
        var componentCodes = lines.Select(x => x.ComponentMaterialCode).Distinct().ToList();
        var names = await db.Materials.AsNoTracking().Where(x => componentCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var withStructure = (await db.ProductStructures.AsNoTracking().Where(x => componentCodes.Contains(x.Code)).Select(x => x.Code).ToListAsync(ct)).ToHashSet();
        var operationCodes = lines.Select(x => x.ProductionOperationCode).OfType<string>().Distinct().ToList();
        var operations = await db.ProductionOperations.AsNoTracking().Where(x => operationCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);
        var stamp = await RecordStamps.ForAsync(db, [row], ct);
        return new ProductStructureDto(row.Code, product?.Name ?? row.Code, product?.UomCode ?? "", row.Note, row.IsActive, stamp(row), row.Version,
            lines.Select(x => new ProductStructureLineDto(x.LineNo, x.ComponentMaterialCode, names.GetValueOrDefault(x.ComponentMaterialCode), x.UomCode,
                x.ProductionOperationCode, x.ProductionOperationCode is null ? null : operations.GetValueOrDefault(x.ProductionOperationCode),
                x.Quantity, x.ScrapPercent, x.Note, withStructure.Contains(x.ComponentMaterialCode))).ToList());
    }

    private static string Code(string? text) => (text ?? string.Empty).Trim().ToUpperInvariant();
}
