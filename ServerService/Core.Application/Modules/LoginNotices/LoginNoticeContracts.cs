using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.LoginNotices;

public sealed record LoginNoticeDto(string Code, string Title, string Content, string? TitleEn, string? ContentEn, string Kind,
    DateOnly? StartDate, DateOnly? EndDate, bool Pinned, string? LoginImageCode, bool IsActive, int SortOrder, RecordStampDto Stamp, uint Version);

/// <summary>Kind is INFO, WELCOME, MAINTENANCE, RULE or BACKGROUND (needs a picture); the dates are inclusive and may be empty.
/// LoginImageCode comes from <c>POST /api/settings/login-notice-images</c>.</summary>
public sealed record SaveLoginNoticeRequest(string Code, string Title, string Content, string? TitleEn = null, string? ContentEn = null,
    string Kind = "INFO", DateOnly? StartDate = null, DateOnly? EndDate = null, bool Pinned = false, string? LoginImageCode = null,
    int SortOrder = 0, bool IsActive = true, uint? Version = null) : ICatalogRequest;

/// <summary>What the login screen shows: text already picked for the visitor's language.</summary>
public sealed record LoginNoticePublicDto(string Code, string Kind, string Title, string Content, bool Pinned, string? ImageCode);

/// <summary>A picture sent as base64 (JPG, PNG or WebP, at most <see cref="LoginImageRules.MaxBytes"/> bytes).</summary>
public sealed record UploadLoginImageRequest(string ContentType, string DataBase64);

public sealed record LoginImageCodeDto(string Code);

public sealed record LoginImageFile(string ContentType, byte[] Data);

public static class LoginImageRules
{
    public const int MaxBytes = 2 * 1024 * 1024;
    public static readonly IReadOnlyList<string> ContentTypes = ["image/jpeg", "image/png", "image/webp"];
}

/// <summary>The catalog (paged list with the filter <c>kind=</c>, export, create, update, delete, import) plus the open read for the login screen.</summary>
public interface ILoginNoticeService : ICatalogService<LoginNoticeDto, SaveLoginNoticeRequest>
{
    /// <summary>Active notices whose date range covers today, in display order. <paramref name="language"/> is a language tag such as "en".</summary>
    Task<IReadOnlyList<LoginNoticePublicDto>> GetPublicAsync(string? language, CancellationToken ct);

    /// <summary>Stores a picture and returns its code (new on every upload). The format is checked from the bytes, not only the header.</summary>
    Task<LoginImageCodeDto> SaveImageAsync(UploadLoginImageRequest request, CancellationToken ct);

    /// <summary>The picture of a code, or null. Open to everyone (the login screen shows it).</summary>
    Task<LoginImageFile?> GetImageAsync(string code, CancellationToken ct);
}
