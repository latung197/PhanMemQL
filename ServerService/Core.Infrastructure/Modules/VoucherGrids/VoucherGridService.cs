using Core.Application.Common.Auditing;
using Core.Application.Common.Caching;
using Core.Application.Common.Documents;
using Core.Application.Common.Exceptions;
using Core.Application.Modules.VoucherGrids;
using Core.Domain.Modules.VoucherGrids;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.VoucherGrids;

/// <summary>
/// The detail grids of the vouchers, shared by the whole system: sys_voucher_grid / sys_voucher_grid_column keep how each grid is
/// shown. The rows are inserted by the seeder from voucher-grids.json (what the code declares); the administrator reorders, retitles,
/// resizes, hides columns and pins the first columns. Cached, and dropped when either table is written.
/// </summary>
public sealed class VoucherGridService(CoreContext db, IAppCache cache, IAuditLog audit) : IVoucherGridService
{
    private const string CacheKey = "voucherGrids";
    private static readonly string[] Tables = ["sys_voucher_grid", "sys_voucher_grid_column"];

    private static VoucherGridDto ToDto(VoucherGrid grid, IEnumerable<VoucherGridColumn> columns) =>
        new(grid.Code, grid.VoucherType, VoucherCatalog.DisplayName(grid.VoucherType, grid.Name), grid.Name, grid.NameEn, grid.TabKey, grid.TabOrder,
            grid.AllowAddRow, grid.AllowDeleteRow, grid.PinCount,
            columns.OrderBy(c => c.SortOrder).ThenBy(c => c.Id).Select(c => new VoucherGridColumnDto(c.Field, c.Header, c.HeaderEn, c.ColType, c.Width,
                c.MinWidth, c.Align, c.Decimals, c.IsRequired, c.IsReadOnly, c.IsVisible, c.IsRequired, c.Summary, c.SummaryFormat, c.SortOrder)).ToList(),
            grid.Version);

    public Task<IReadOnlyList<VoucherGridDto>> GetAllAsync(CancellationToken ct) =>
        db.CachedAsync(cache, CacheKey, Tables, async token =>
        {
            var grids = await db.VoucherGrids.AsNoTracking().OrderBy(x => x.VoucherType).ThenBy(x => x.TabOrder).ToListAsync(token);
            var columns = (await db.VoucherGridColumns.AsNoTracking().ToListAsync(token)).ToLookup(x => x.VoucherGridCode);
            return (IReadOnlyList<VoucherGridDto>)grids.Select(g => ToDto(g, columns[g.Code])).ToList();
        }, ct);

    public async Task<VoucherGridDto> UpdateAsync(int userId, string code, SaveVoucherGridRequest request, CancellationToken ct)
    {
        var key = (code ?? string.Empty).Trim().ToUpperInvariant();
        var grid = await db.VoucherGrids.FirstOrDefaultAsync(x => x.Code == key, ct) ?? throw new NotFoundException("voucherGrid.notFound");
        var columns = await db.VoucherGridColumns.Where(x => x.VoucherGridCode == key).ToListAsync(ct);
        var current = ToDto(grid, columns).Columns;
        VoucherGridRules.Validate(request, current);
        db.ExpectVersion(grid, request.Version, touch: true);

        var before = Summary(grid.PinCount, current.Select(c => (c.Field, c.Header, c.Visible, c.Width)));
        var order = 0;
        foreach (var item in request.Columns)
        {
            var row = columns.First(c => c.Field == item.Field);
            row.Header = item.Header.Trim();
            row.HeaderEn = string.IsNullOrWhiteSpace(item.HeaderEn) ? null : item.HeaderEn.Trim();
            row.Width = item.Width;
            row.MinWidth = item.MinWidth;
            row.Decimals = item.Decimals;
            row.IsVisible = item.Visible;
            row.SortOrder = (++order) * 10;
        }
        grid.PinCount = request.PinCount;
        var after = Summary(grid.PinCount, request.Columns.Select(c => (c.Field, c.Header, c.Visible, c.Width)));
        audit.Attach(grid, [new AuditChange("columns", before, after)]);
        await db.SaveChangesAsync(ct);
        return ToDto(grid, columns);
    }

    private static string Summary(int pinned, IEnumerable<(string Field, string Header, bool Visible, int? Width)> columns) =>
        $"pin={pinned}; " + string.Join(", ", columns.Select(c => $"{c.Field}{(c.Visible ? "" : "(ẩn)")}{(c.Width is { } w ? $":{w}" : "")}"));
}
