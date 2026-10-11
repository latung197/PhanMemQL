using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.Banners;
using Core.Application.Modules.Notifications;
using Core.Domain.Common;
using Core.Domain.Modules.Banners;
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Banners;

/// <summary>Thanh thông báo hệ thống: a catalog on the shared CatalogService, plus the read of the banners in force for a unit.
/// Every change tells the open browser tabs (the "settings" signal) so the strip updates without a reload.</summary>
public sealed class BannerService(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit, INotificationStream stream)
    : CatalogService<Banner, BannerDto, SaveBannerRequest>(db, batch, excel, audit), IBannerService
{
    private static readonly CatalogSpec Info = new("sys_banners", "banner", "field.bannerCode", 30, "ThanhThongBaoHeThong");

    private static readonly SortMap<Banner> SortColumns = SortMap<Banner>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("message", x => x.Message).Add("level", x => x.Level)
        .Add("startAt", x => x.StartAt).Add("endAt", x => x.EndAt).Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<Banner> Sorts => SortColumns;

    protected override IQueryable<Banner> Search(IQueryable<Banner> rows, string pattern) =>
        rows.Where(x => SearchFunctions.Matches(x.Code, pattern) || SearchFunctions.Matches(x.Message, pattern));

    /// <summary>Filter: <c>level=URGENT</c> (or INFO, WARNING).</summary>
    protected override IQueryable<Banner> ApplyFilters(IQueryable<Banner> rows, IReadOnlyDictionary<string, string> filters)
    {
        if (filters.TryGetValue("level", out var level) && !string.IsNullOrWhiteSpace(level))
        {
            var code = level.Trim().ToUpperInvariant();
            rows = rows.Where(x => x.Level == code);
        }
        return rows;
    }

    protected override IReadOnlyList<ExportColumn<Banner>> ExportColumns() =>
    [
        new("export.banner.code", x => x.Code), new("export.banner.message", x => x.Message),
        new("export.banner.messageEn", x => x.MessageEn), new("export.banner.level", x => x.Level),
        new("export.banner.startAt", x => x.StartAt?.ToString("yyyy-MM-ddTHH:mm:ssZ")),
        new("export.banner.endAt", x => x.EndAt?.ToString("yyyy-MM-ddTHH:mm:ssZ")),
        new("export.banner.unitCodes", x => x.UnitCodes), new("export.banner.sortOrder", x => x.SortOrder),
        new("export.banner.isActive", x => YesNo(x.IsActive))
    ];

    protected override SaveBannerRequest WithoutVersion(SaveBannerRequest request) => request with { Version = null };

    protected override Task<IReadOnlyList<BannerDto>> MapAsync(IReadOnlyList<Banner> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<BannerDto>>(rows.Select(x => new BannerDto(x.Code, x.Message, x.MessageEn, x.Level, x.StartAt,
            x.EndAt, x.UnitCodes, x.IsActive, x.SortOrder, stamp(x), x.Version)).ToList());

    protected override async Task ApplyAsync(Banner row, SaveBannerRequest request, CancellationToken ct)
    {
        var level = (request.Level ?? string.Empty).Trim().ToUpperInvariant();
        if (!BannerLevels.All.Contains(level)) throw new BusinessRuleException("banner.levelInvalid");
        if (request.StartAt is { } start && request.EndAt is { } end && end < start) throw new BusinessRuleException("banner.timeOrder");

        var units = (request.UnitCodes ?? string.Empty).Split([',', ';', ' '], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => x.ToUpperInvariant()).Distinct().ToList();
        if (units.Count > 0)
        {
            var known = await Db.CompanyUnits.AsNoTracking().Where(x => units.Contains(x.Code)).Select(x => x.Code).ToListAsync(ct);
            var unknown = units.FirstOrDefault(x => !known.Contains(x));
            if (unknown is not null) throw new BusinessRuleException("banner.unitNotFound", unknown);
        }

        row.Message = Guard.Required(request.Message, 500, "field.message");
        row.MessageEn = Guard.Optional(request.MessageEn, 500, "field.messageEn");
        row.Level = level;
        row.StartAt = request.StartAt?.ToUniversalTime();
        row.EndAt = request.EndAt?.ToUniversalTime();
        row.UnitCodes = string.Join(',', units);
        row.SortOrder = request.SortOrder;
        row.IsActive = request.IsActive;
    }

    /// <summary>Saves, then signals the open tabs to read the banners again.</summary>
    protected override async Task SaveAsync(CancellationToken ct)
    {
        await base.SaveAsync(ct);
        stream.PublishSettings();
    }

    public async Task<IReadOnlyList<BannerActiveDto>> GetActiveAsync(string unitCode, string? language, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var english = language?.Trim().StartsWith("en", StringComparison.OrdinalIgnoreCase) == true;
        var unit = unitCode.Trim().ToUpperInvariant();
        var rows = await Db.Banners.AsNoTracking()
            .Where(x => x.IsActive && (x.StartAt == null || x.StartAt <= now) && (x.EndAt == null || x.EndAt >= now))
            .ToListAsync(ct);
        return rows
            .Where(x => x.UnitCodes.Length == 0 || x.UnitCodes.Split(',').Contains(unit))
            .OrderByDescending(x => x.Level == BannerLevels.Urgent).ThenByDescending(x => x.Level == BannerLevels.Warning)
            .ThenBy(x => x.SortOrder).ThenBy(x => x.Code).Take(5)
            .Select(x => new BannerActiveDto(x.Code, x.Level,
                english && !string.IsNullOrWhiteSpace(x.MessageEn) ? x.MessageEn! : x.Message, x.EndAt, x.Version))
            .ToList();
    }
}
