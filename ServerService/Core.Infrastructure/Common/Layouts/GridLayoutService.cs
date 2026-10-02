using System.Text.Json;
using Core.Application.Common.Caching;
using Core.Application.Common.Layouts;
using Core.Domain.Common;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Common.Layouts;

/// <summary>Layouts of lists (sys_grid_layout): one per user and list, plus the company default (user_id null).</summary>
public sealed class GridLayoutService(CoreContext db, IAppCache cache) : IGridLayoutService
{
    private static readonly string[] Tables = ["sys_grid_layout"];

    public async Task<GridLayoutDto> GetAsync(int userId, string functionCode, string gridKey, CancellationToken ct)
    {
        GridLayoutRules.ValidateKey(gridKey);
        // Read each time a list opens: cached per user and list until a layout is saved.
        var rows = await db.CachedAsync(cache, $"grid:{functionCode}:{gridKey}:{userId}", Tables, async token =>
            await db.Set<GridLayout>().AsNoTracking()
                .Where(x => x.FunctionCode == functionCode && x.GridKey == gridKey && (x.UserId == userId || x.UserId == null))
                .Select(x => new { x.UserId, x.Layout }).ToListAsync(token), ct);
        return new GridLayoutDto(Parse(rows.FirstOrDefault(x => x.UserId == userId)?.Layout),
            Parse(rows.FirstOrDefault(x => x.UserId == null)?.Layout));
    }

    public async Task SaveAsync(int actorUserId, int? userId, string functionCode, string gridKey, JsonElement layout,
        CancellationToken ct)
    {
        GridLayoutRules.ValidateKey(gridKey);
        GridLayoutRules.Validate(layout);
        var row = await db.Set<GridLayout>().FirstOrDefaultAsync(
            x => x.FunctionCode == functionCode && x.GridKey == gridKey && x.UserId == userId, ct);
        if (row is null)
            db.Set<GridLayout>().Add(row = new GridLayout { FunctionCode = functionCode, GridKey = gridKey, UserId = userId });
        row.Layout = layout.GetRawText();
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedBy = actorUserId;
        await db.SaveChangesAsync(ct);
    }

    public async Task ResetAsync(int? userId, string functionCode, string gridKey, CancellationToken ct)
    {
        GridLayoutRules.ValidateKey(gridKey);
        await db.Set<GridLayout>()
            .Where(x => x.FunctionCode == functionCode && x.GridKey == gridKey && x.UserId == userId)
            .ExecuteDeleteAsync(ct);
    }

    private static JsonElement? Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}
