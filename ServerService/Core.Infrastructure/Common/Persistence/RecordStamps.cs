using Core.Application.Common.Persistence;
using Core.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Common.Persistence;

/// <summary>Builds RecordStampDto for erp_* rows, looking up the users' names with one query.</summary>
public static class RecordStamps
{
    /// <summary>A function giving the stamp of each of the rows (names of all their users read at once).</summary>
    public static async Task<Func<ErpEntity, RecordStampDto>> ForAsync(CoreContext db, IEnumerable<ErpEntity> rows,
        CancellationToken ct)
    {
        var ids = rows.SelectMany(r => new[] { r.CreatedBy, r.UpdatedBy }).OfType<int>().Distinct().ToList();
        var names = ids.Count == 0 ? new Dictionary<int, string>()
            : await db.Users.AsNoTracking().Where(u => ids.Contains(u.UserId)).ToDictionaryAsync(u => u.UserId, u => u.FullName, ct);
        string? Name(int? id) => id is int value ? names.GetValueOrDefault(value) : null;
        return row => new RecordStampDto(row.CreatedAt, Name(row.CreatedBy), row.UpdatedAt, Name(row.UpdatedBy));
    }

    public static async Task<RecordStampDto> OfAsync(CoreContext db, ErpEntity row, CancellationToken ct) =>
        (await ForAsync(db, [row], ct))(row);
}
