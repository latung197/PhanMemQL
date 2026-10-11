using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.LoginNotices;
using Core.Domain.Common;
using Core.Domain.Modules.LoginNotices;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.LoginNotices;

/// <summary>Thông báo trang đăng nhập: a catalog on the shared CatalogService, plus the anonymous read of the notices in force today.</summary>
public sealed class LoginNoticeService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<LoginNotice, LoginNoticeDto, SaveLoginNoticeRequest>(db, batch, excel, audit), ILoginNoticeService
{
    private static readonly CatalogSpec Info = new("sys_login_notices", "loginNotice", "field.loginNoticeCode", 30, "ThongBaoTrangDangNhap");

    private static readonly SortMap<LoginNotice> SortColumns = SortMap<LoginNotice>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("title", x => x.Title).Add("kind", x => x.Kind)
        .Add("pinned", x => x.Pinned).Add("startDate", x => x.StartDate).Add("endDate", x => x.EndDate).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<LoginNotice> Sorts => SortColumns;

    protected override IQueryable<LoginNotice> Search(IQueryable<LoginNotice> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Title, pattern)
            || SearchFunctions.Matches(x.Content, pattern));

    /// <summary>Filter: <c>kind=WELCOME</c> (or INFO, MAINTENANCE, RULE).</summary>
    protected override IQueryable<LoginNotice> ApplyFilters(IQueryable<LoginNotice> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("kind", out var kind) && !string.IsNullOrWhiteSpace(kind))
        {
            var code = kind.Trim().ToUpperInvariant();
            rows = rows.Where(x => x.Kind == code);
        }
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<LoginNotice>> ExportColumns() =>
    [
        new("export.loginNotice.code", x => x.Code), new("export.loginNotice.title", x => x.Title),
        new("export.loginNotice.content", x => x.Content), new("export.loginNotice.titleEn", x => x.TitleEn),
        new("export.loginNotice.contentEn", x => x.ContentEn), new("export.loginNotice.kind", x => x.Kind),
        new("export.loginNotice.startDate", x => x.StartDate?.ToString("yyyy-MM-dd")),
        new("export.loginNotice.endDate", x => x.EndDate?.ToString("yyyy-MM-dd")),
        new("export.loginNotice.pinned", x => YesNo(x.Pinned)), new("export.loginNotice.imageCode", x => x.LoginImageCode),
        new("export.loginNotice.sortOrder", x => x.SortOrder), new("export.loginNotice.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveLoginNoticeRequest WithoutVersion(SaveLoginNoticeRequest request) => request with { Version = null };

    protected override Task<IReadOnlyList<LoginNoticeDto>> MapAsync(IReadOnlyList<LoginNotice> rows,
        Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<LoginNoticeDto>>(rows.Select(x => new LoginNoticeDto(x.Code, x.Title, x.Content, x.TitleEn,
            x.ContentEn, x.Kind, x.StartDate, x.EndDate, x.Pinned, x.LoginImageCode, x.IsActive, x.SortOrder, stamp(x), x.Version)).ToList());

    protected override Task ApplyAsync(LoginNotice row, SaveLoginNoticeRequest request, CancellationToken ct)
    {
        var kind = (request.Kind ?? string.Empty).Trim().ToUpperInvariant();
        if (!LoginNoticeKinds.All.Contains(kind)) throw new BusinessRuleException("loginNotice.kindInvalid");
        if (request.StartDate is { } start && request.EndDate is { } end && end < start) throw new BusinessRuleException("loginNotice.dateOrder");
        var imageCode = string.IsNullOrWhiteSpace(request.LoginImageCode) ? null : request.LoginImageCode.Trim().ToUpperInvariant();
        if (kind == LoginNoticeKinds.Background && imageCode is null) throw new BusinessRuleException("loginNotice.imageRequired");
        row.Title = Guard.Required(request.Title, 200, "field.title");
        row.Content = Guard.Optional(request.Content, 2000, "field.content") ?? string.Empty;
        row.TitleEn = Guard.Optional(request.TitleEn, 200, "field.titleEn");
        row.ContentEn = Guard.Optional(request.ContentEn, 2000, "field.contentEn");
        row.Kind = kind;
        row.Pinned = request.Pinned;
        row.LoginImageCode = imageCode;
        row.StartDate = request.StartDate;
        row.EndDate = request.EndDate;
        row.SortOrder = request.SortOrder;
        row.IsActive = request.IsActive;
        return Task.CompletedTask;
    }

    /// <summary>A picture the notice no longer uses is deleted with it (the picture of the other notices stays).</summary>
    protected override async Task AfterApplyAsync(LoginNotice row, SaveLoginNoticeRequest request, bool isNew, CancellationToken ct)
    {
        if (isNew) return;
        var before = Db.Entry(row).Property(x => x.LoginImageCode).OriginalValue;
        if (before is not null && before != row.LoginImageCode) await DeleteImageIfUnusedAsync(before, row.Code, ct);
    }

    protected override async Task BeforeDeleteAsync(LoginNotice row, CancellationToken ct)
    {
        if (row.LoginImageCode is not null) await DeleteImageIfUnusedAsync(row.LoginImageCode, row.Code, ct);
    }

    private async Task DeleteImageIfUnusedAsync(string imageCode, string exceptNoticeCode, CancellationToken ct)
    {
        if (await Db.LoginNotices.AnyAsync(x => x.Code != exceptNoticeCode && x.LoginImageCode == imageCode, ct)) return;
        var image = await Db.LoginImages.FirstOrDefaultAsync(x => x.Code == imageCode, ct);
        if (image is not null) Db.LoginImages.Remove(image);
    }

    public async Task<IReadOnlyList<LoginNoticePublicDto>> GetPublicAsync(string? language, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.Now);
        var english = language?.Trim().StartsWith("en", StringComparison.OrdinalIgnoreCase) == true;
        var rows = await Db.LoginNotices.AsNoTracking()
            .Where(x => x.IsActive && (x.StartDate == null || x.StartDate <= today) && (x.EndDate == null || x.EndDate >= today))
            .OrderByDescending(x => x.Pinned).ThenBy(x => x.SortOrder).ThenBy(x => x.Code).Take(10).ToListAsync(ct);
        return rows.Select(x => english && !string.IsNullOrWhiteSpace(x.TitleEn)
            ? new LoginNoticePublicDto(x.Code, x.Kind, x.TitleEn!, x.ContentEn ?? string.Empty, x.Pinned, x.LoginImageCode)
            : new LoginNoticePublicDto(x.Code, x.Kind, x.Title, x.Content, x.Pinned, x.LoginImageCode)).ToList();
    }

    public async Task<LoginImageCodeDto> SaveImageAsync(UploadLoginImageRequest request, CancellationToken ct)
    {
        var type = (request.ContentType ?? string.Empty).Trim().ToLowerInvariant();
        if (!LoginImageRules.ContentTypes.Contains(type)) throw new BusinessRuleException("loginImage.typeInvalid");
        byte[] data;
        try { data = Convert.FromBase64String(request.DataBase64 ?? string.Empty); }
        catch (FormatException) { throw new BusinessRuleException("loginImage.dataInvalid"); }
        if (data.Length == 0) throw new BusinessRuleException("loginImage.dataInvalid");
        if (data.Length > LoginImageRules.MaxBytes) throw new BusinessRuleException("loginImage.tooLarge", LoginImageRules.MaxBytes / 1024 / 1024);
        if (!MatchesSignature(type, data)) throw new BusinessRuleException("loginImage.dataInvalid");
        var image = new LoginImage { Code = "IMG-" + Guid.NewGuid().ToString("N")[..16].ToUpperInvariant(), ContentType = type, SizeBytes = data.Length, Data = data };
        Db.LoginImages.Add(image);
        await Db.SaveChangesAsync(ct);
        return new LoginImageCodeDto(image.Code);
    }

    /// <summary>The first bytes must really be the declared format: a text or script renamed to .png is refused.</summary>
    private static bool MatchesSignature(string type, byte[] d) => type switch
    {
        "image/jpeg" => d.Length > 3 && d[0] == 0xFF && d[1] == 0xD8 && d[2] == 0xFF,
        "image/png" => d.Length > 8 && d[0] == 0x89 && d[1] == 0x50 && d[2] == 0x4E && d[3] == 0x47,
        "image/webp" => d.Length > 12 && d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F' && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P',
        _ => false
    };

    public async Task<LoginImageFile?> GetImageAsync(string code, CancellationToken ct)
    {
        var key = (code ?? string.Empty).Trim().ToUpperInvariant();
        var image = await Db.LoginImages.AsNoTracking().Where(x => x.Code == key).Select(x => new { x.ContentType, x.Data }).FirstOrDefaultAsync(ct);
        return image is null ? null : new LoginImageFile(image.ContentType, image.Data);
    }
}
