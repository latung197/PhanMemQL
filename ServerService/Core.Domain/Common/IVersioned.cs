namespace Core.Domain.Common;

/// <summary>
/// A record edited in a form: two users may open it at the same time. <see cref="Version"/> is PostgreSQL's row version
/// (system column xmin, mapped by CoreContext, changes on every update). The screen sends back the version it loaded;
/// a save over a newer version is refused (HTTP 409, record.changed) instead of silently overwriting the other change.
/// Every ErpEntity has it; legacy sys_* entities edited in forms implement it themselves.
/// </summary>
public interface IVersioned
{
    uint Version { get; set; }
}
