using Core.Application.Common.Exceptions;
using Core.Domain.Modules.Purchasing.Categories.Projects;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Purchasing.Categories;

/// <summary>
/// The project column of a voucher: empty is fine; a code must be a project that is in use and still takes vouchers (planned or
/// running). A voucher that already carries a project keeps it when the project is later put on hold or closed.
/// </summary>
public static class ProjectChecks
{
    /// <summary>Upper-case code or null when the box is empty.</summary>
    public static string? Normalize(string? code) => string.IsNullOrWhiteSpace(code) ? null : code.Trim().ToUpperInvariant();

    /// <param name="current">The project the voucher has now (null for a new voucher): choosing it again is always allowed.</param>
    public static async Task EnsureAsync(CoreContext db, string? code, string? current, CancellationToken ct)
    {
        var key = Normalize(code);
        if (key is null || string.Equals(key, current, StringComparison.Ordinal)) return;
        var project = await db.Projects.AsNoTracking().Where(x => x.Code == key).Select(x => new { x.IsActive, x.Status }).FirstOrDefaultAsync(ct)
            ?? throw new BusinessRuleException("project.notFound");
        if (!project.IsActive || !ProjectStatuses.TakesVouchers(project.Status)) throw new BusinessRuleException("project.closed", key);
    }
}
