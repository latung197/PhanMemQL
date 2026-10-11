using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.Banners;

public sealed record BannerDto(string Code, string Message, string? MessageEn, string Level, DateTime? StartAt, DateTime? EndAt,
    string UnitCodes, bool IsActive, int SortOrder, RecordStampDto Stamp, uint Version);

/// <summary>Level is INFO, WARNING or URGENT; StartAt / EndAt are UTC instants and may be empty; UnitCodes are company unit
/// codes separated by commas (empty = every unit).</summary>
public sealed record SaveBannerRequest(string Code, string Message, string? MessageEn = null, string Level = "INFO",
    DateTime? StartAt = null, DateTime? EndAt = null, string? UnitCodes = null, int SortOrder = 0, bool IsActive = true,
    uint? Version = null) : ICatalogRequest;

/// <summary>What the banner strip shows: the text already picked for the user's language. Version changes when the banner is
/// edited, so a banner the user closed shows again after an edit.</summary>
public sealed record BannerActiveDto(string Code, string Level, string Message, DateTime? EndAt, uint Version);

/// <summary>The catalog (paged list with the filter <c>level=</c>, export, create, update, delete, import) plus the read of the
/// banners in force.</summary>
public interface IBannerService : ICatalogService<BannerDto, SaveBannerRequest>
{
    /// <summary>Active banners in force now for the company unit, most urgent first. <paramref name="language"/> is a tag such as "en".</summary>
    Task<IReadOnlyList<BannerActiveDto>> GetActiveAsync(string unitCode, string? language, CancellationToken ct);
}
