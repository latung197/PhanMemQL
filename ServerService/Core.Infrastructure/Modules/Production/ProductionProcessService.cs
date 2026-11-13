using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Production;
using Core.Domain.Common;
using Core.Domain.Modules.Production;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Production;

/// <summary>
/// Danh mục quy trình sản xuất on the shared CatalogService. Besides its fields a process has the company units it applies to
/// (erp_production_process_unit; none = every unit) and its ordered operations (erp_production_process_line), both saved by
/// <see cref="AfterApplyAsync"/> in the same transaction as the header.
/// </summary>
public sealed class ProductionProcessService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<ProductionProcess, ProductionProcessDto, SaveProductionProcessRequest>(db, batch, excel, audit), IProductionProcessService
{
    private static readonly CatalogSpec Info = new("prod_process_cat", "productionProcess", "field.productionProcessCode", 20, "DanhMucQuyTrinhSanXuat", CodeChange: true);

    private static readonly SortMap<ProductionProcess> SortColumns = SortMap<ProductionProcess>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name).Add("nameEn", x => x.NameEn)
        .Add("effectiveFrom", x => x.EffectiveFrom).Add("effectiveTo", x => x.EffectiveTo).Add("isActive", x => x.IsActive).AddRecordStamps();

    /// <summary>Units and operations of the processes being exported, read once by <see cref="BeforeExportAsync"/>.</summary>
    private Dictionary<string, string> _exportUnits = [];
    private Dictionary<string, string> _exportOperations = [];

    protected override CatalogSpec Spec => Info;
    protected override SortMap<ProductionProcess> Sorts => SortColumns;

    protected override IQueryable<ProductionProcess> Search(IQueryable<ProductionProcess> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Name, pattern) || SearchFunctions.Matches(x.NameEn, pattern)
            || SearchFunctions.Matches(x.Note, pattern)
            || Db.ProductionProcessUnits.Any(u => u.ProcessCode == x.Code && SearchFunctions.Matches(u.UnitCode, pattern))
            || Db.ProductionProcessLines.Any(l => l.ProcessCode == x.Code && SearchFunctions.Matches(l.OperationCode, pattern)));

    /// <summary>Filters <c>unit=DVCS01</c> (processes that unit may use, shared ones included) and <c>operation=MRV</c> (processes that contain the operation).</summary>
    protected override IQueryable<ProductionProcess> ApplyFilters(IQueryable<ProductionProcess> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("unit", out var unit) && !string.IsNullOrWhiteSpace(unit))
        {
            var code = unit.Trim().ToUpperInvariant();
            rows = rows.Where(x => !Db.ProductionProcessUnits.Any(u => u.ProcessCode == x.Code)
                || Db.ProductionProcessUnits.Any(u => u.ProcessCode == x.Code && u.UnitCode == code));
        }
        if (filters.TryGetValue("operation", out var operation) && !string.IsNullOrWhiteSpace(operation))
        {
            var code = operation.Trim().ToUpperInvariant();
            rows = rows.Where(x => Db.ProductionProcessLines.Any(l => l.ProcessCode == x.Code && l.OperationCode == code));
        }
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<ProductionProcess>> ExportColumns() =>
    [
        new("export.productionProcess.code", x => x.Code), new("export.productionProcess.name", x => x.Name),
        new("export.productionProcess.nameEn", x => x.NameEn),
        new("export.productionProcess.effectiveFrom", x => x.EffectiveFrom.ToString("yyyy-MM-dd")),
        new("export.productionProcess.effectiveTo", x => x.EffectiveTo?.ToString("yyyy-MM-dd")),
        new("export.productionProcess.unitCodes", x => _exportUnits.GetValueOrDefault(x.Code, string.Empty)),
        new("export.productionProcess.operationCodes", x => _exportOperations.GetValueOrDefault(x.Code, string.Empty)),
        new("export.productionProcess.note", x => x.Note), new("export.productionProcess.isActive", x => YesNo(x.IsActive))
    ];

    protected override async Task BeforeExportAsync(IReadOnlyList<ProductionProcess> rows, CancellationToken ct)
    {
        var codes = rows.Select(x => x.Code).ToList();
        var units = await Db.ProductionProcessUnits.AsNoTracking().Where(x => codes.Contains(x.ProcessCode)).ToListAsync(ct);
        _exportUnits = units.GroupBy(x => x.ProcessCode)
            .ToDictionary(g => g.Key, g => string.Join(", ", g.Select(x => x.UnitCode).Order(StringComparer.Ordinal)));
        var lines = await Db.ProductionProcessLines.AsNoTracking().Where(x => codes.Contains(x.ProcessCode)).ToListAsync(ct);
        _exportOperations = lines.GroupBy(x => x.ProcessCode)
            .ToDictionary(g => g.Key, g => string.Join(", ", g.OrderBy(x => x.LineNo).Select(x => x.OperationCode)));
    }

    protected override SaveProductionProcessRequest WithoutVersion(SaveProductionProcessRequest request) => request with { Version = null };

    protected override async Task<IReadOnlyList<ProductionProcessDto>> MapAsync(IReadOnlyList<ProductionProcess> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct)
    {
        var codes = rows.Select(x => x.Code).ToList();
        var units = await Db.ProductionProcessUnits.AsNoTracking().Where(x => codes.Contains(x.ProcessCode)).ToListAsync(ct);
        var unitsByProcess = units.GroupBy(x => x.ProcessCode)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(x => x.UnitCode).Order(StringComparer.Ordinal).ToList());

        var lines = await Db.ProductionProcessLines.AsNoTracking().Where(x => codes.Contains(x.ProcessCode)).ToListAsync(ct);
        var operationCodes = lines.Select(x => x.OperationCode).Distinct().ToList();
        var operations = await Db.ProductionOperations.AsNoTracking().Where(x => operationCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, ct);
        var teamCodes = operations.Values.Select(x => x.ProductionTeamCode).OfType<string>().Distinct().ToList();
        var teams = await Db.ProductionTeams.AsNoTracking().Where(x => teamCodes.Contains(x.Code)).ToDictionaryAsync(x => x.Code, x => x.Name, ct);

        ProductionProcessLineDto ToLine(ProductionProcessLine line)
        {
            operations.TryGetValue(line.OperationCode, out var operation);
            var team = operation?.ProductionTeamCode;
            return new ProductionProcessLineDto(line.LineNo, line.OperationCode, operation?.Name, team, team is null ? null : teams.GetValueOrDefault(team));
        }

        var linesByProcess = lines.GroupBy(x => x.ProcessCode)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<ProductionProcessLineDto>)g.OrderBy(x => x.LineNo).Select(ToLine).ToList());
        return rows.Select(x => new ProductionProcessDto(x.Code, x.Name, x.NameEn, x.EffectiveFrom, x.EffectiveTo, x.Note, x.IsActive, stamp(x), x.Version,
            unitsByProcess.GetValueOrDefault(x.Code) ?? [], linesByProcess.GetValueOrDefault(x.Code) ?? [])).ToList();
    }

    protected override async Task ApplyAsync(ProductionProcess row, SaveProductionProcessRequest request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, 200, "field.productionProcessName");
        if (request.EffectiveFrom == default) throw new BusinessRuleException("productionProcess.dateRequired");
        if (request.EffectiveTo is { } to && to < request.EffectiveFrom) throw new BusinessRuleException("productionProcess.dateOrder");
        if (await Db.ProductionProcesses.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("productionProcess.nameExists", name);
        row.Name = name;
        row.NameEn = Guard.Optional(request.NameEn, 200, "field.nameEn");
        row.EffectiveFrom = request.EffectiveFrom;
        row.EffectiveTo = request.EffectiveTo;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        row.IsActive = request.IsActive;
    }

    protected override async Task AfterApplyAsync(ProductionProcess row, SaveProductionProcessRequest request, bool isNew, CancellationToken ct)
    {
        var changed = await SaveUnitsAsync(row, request.UnitCodes, ct);
        changed |= await SaveLinesAsync(row, request.OperationCodes, isNew, ct);
        // A units- or steps-only edit must advance the process version so concurrent forms cannot overwrite it.
        if (!isNew && changed) Db.Entry(row).Property(x => x.Name).IsModified = true;
    }

    private async Task<bool> SaveUnitsAsync(ProductionProcess row, string? unitCodes, CancellationToken ct)
    {
        // Null = an older client or an Excel file without the column: keep the units the process has.
        if (unitCodes is null) return false;
        var wanted = Split(unitCodes);
        var existing = await Db.ProductionProcessUnits.Where(x => x.ProcessCode == row.Code).ToListAsync(ct);
        var added = wanted.Where(code => existing.All(x => x.UnitCode != code)).ToList();
        if (added.Count > 0)
        {
            // A unit that is not on the process yet must exist and be active; units already there stay even if stopped.
            var units = await Db.CompanyUnits.AsNoTracking().Where(x => added.Contains(x.Code)).ToListAsync(ct);
            var bad = added.Where(code => units.All(x => x.Code != code || !x.IsActive)).ToList();
            if (bad.Count > 0) throw new BusinessRuleException("productionProcess.unitInvalid", string.Join(", ", bad));
        }
        var removed = existing.Where(x => !wanted.Contains(x.UnitCode)).ToList();
        Db.ProductionProcessUnits.RemoveRange(removed);
        foreach (var code in added) Db.ProductionProcessUnits.Add(new ProductionProcessUnit { ProcessCode = row.Code, UnitCode = code });
        return added.Count > 0 || removed.Count > 0;
    }

    private async Task<bool> SaveLinesAsync(ProductionProcess row, string? operationCodes, bool isNew, CancellationToken ct)
    {
        // Null = an older client or an Excel file without the column: keep the steps the process has (a new process cannot have none).
        if (operationCodes is null)
        {
            if (isNew) throw new BusinessRuleException("productionProcess.noLines");
            return false;
        }
        var wanted = Split(operationCodes, keepDuplicates: true);
        if (wanted.Count == 0) throw new BusinessRuleException("productionProcess.noLines");

        var existing = (await Db.ProductionProcessLines.Where(x => x.ProcessCode == row.Code).ToListAsync(ct)).OrderBy(x => x.LineNo).ToList();
        var before = existing.Select(x => x.OperationCode).ToList();
        var known = await Db.ProductionOperations.AsNoTracking().Where(x => wanted.Contains(x.Code)).ToDictionaryAsync(x => x.Code, ct);
        // Every step must exist; one that is not on the process yet must also be an operation still in use.
        var missing = wanted.Distinct().Where(code => !known.ContainsKey(code)).ToList();
        if (missing.Count > 0) throw new BusinessRuleException("productionProcess.operationNotFound", string.Join(", ", missing));
        var stopped = wanted.Distinct().Where(code => !known[code].IsActive && existing.All(x => x.OperationCode != code)).ToList();
        if (stopped.Count > 0) throw new BusinessRuleException("productionProcess.operationInactive", string.Join(", ", stopped));

        // Rows keep their place (the key is process + step number): change the code in place, add the new tail, drop the old one.
        var changed = false;
        for (var i = 0; i < wanted.Count; i++)
        {
            if (i < existing.Count)
            {
                if (existing[i].OperationCode == wanted[i]) continue;
                existing[i].OperationCode = wanted[i];
                changed = true;
            }
            else
            {
                Db.ProductionProcessLines.Add(new ProductionProcessLine { ProcessCode = row.Code, LineNo = i + 1, OperationCode = wanted[i] });
                changed = true;
            }
        }
        if (existing.Count > wanted.Count)
        {
            Db.ProductionProcessLines.RemoveRange(existing.Skip(wanted.Count));
            changed = true;
        }
        // The steps are edited in place, so the change log gets them as one field (the units are rows added / removed and log themselves).
        if (changed) AuditLog.Attach(row, [new AuditChange("operations", isNew ? null : string.Join(", ", before), string.Join(", ", wanted))]);
        return changed;
    }

    protected override async Task BeforeDeleteAsync(ProductionProcess row, CancellationToken ct)
    {
        // Vouchers that follow a process will be checked from their [References<ProductionProcess>] columns.
        Db.ProductionProcessUnits.RemoveRange(await Db.ProductionProcessUnits.Where(x => x.ProcessCode == row.Code).ToListAsync(ct));
        Db.ProductionProcessLines.RemoveRange(await Db.ProductionProcessLines.Where(x => x.ProcessCode == row.Code).ToListAsync(ct));
    }

    private static List<string> Split(string text, bool keepDuplicates = false)
    {
        var items = text.Split([',', ';', ' ', '\n', '\r', '\t'], StringSplitOptions.RemoveEmptyEntries).Select(x => x.Trim().ToUpperInvariant());
        return (keepDuplicates ? items : items.Distinct(StringComparer.Ordinal)).ToList();
    }
}
