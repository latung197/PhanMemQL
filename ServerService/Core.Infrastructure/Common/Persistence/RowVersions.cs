using Core.Application.Common.Exceptions;
using Core.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Common.Persistence;

/// <summary>
/// Protection against lost updates for records edited in forms (IVersioned): the screen sends back the version it
/// loaded, and the save is refused with record.changed (HTTP 409) when someone else changed the record in between.
/// </summary>
public static class RowVersions
{
    /// <summary>
    /// Call on the loaded (tracked) record before changing it. Refuses at once when the record is already newer, and
    /// makes the UPDATE itself conditional on that version (CoreContext turns a miss into the same error), which also
    /// covers a change saved between this read and the save. A null version is not checked (imports, old clients).
    /// <paramref name="touch"/>: the save may change only child rows (a role's permissions, a user's units); the row is
    /// then updated anyway (its update stamp) so the version still moves and the check still runs.
    /// </summary>
    public static void ExpectVersion<T>(this DbContext db, T entity, uint? version, bool touch = false)
        where T : class, IVersioned
    {
        var entry = db.Entry(entity);
        if (version is { } expected)
        {
            if (entity.Version != expected) throw new ConflictException("record.changed");
            entry.Property(x => x.Version).OriginalValue = expected;
        }
        if (touch && entry.State == EntityState.Unchanged)
            entry.Property(entity switch
            {
                ErpEntity => nameof(ErpEntity.UpdatedAt),
                IAuditable => nameof(IAuditable.UpdateTime),
                _ => throw new InvalidOperationException($"{typeof(T).Name} has no update stamp to touch.")
            }).IsModified = true;
    }
}
