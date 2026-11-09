using System.Collections.Concurrent;
using System.Text.Json;
using Core.Application.Common.Caching;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Paging;
using Core.Application.Common.Security;
using Core.Application.Modules.Auth;
using Core.Application.Modules.Users;
using Core.Domain.Modules.SystemConfig;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Caching;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.Auth;

/// <summary>The security policy (global setting SECURITY_POLICY, cached until sys_setting is written) and the password rules that need the database.</summary>
public sealed class SecurityPolicyService(CoreContext db, IAppCache cache, IPasswordService passwords) : ISecurityPolicyService
{
    public const string SettingKey = "SECURITY_POLICY";
    /// <summary>Earlier hashes kept per account (the policy may ask for up to this many).</summary>
    private const int KeptHistory = 24;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<SecurityPolicy> GetAsync(CancellationToken ct) =>
        await db.CachedAsync(cache, "security:policy", ["sys_setting"], async token =>
        {
            var json = await db.SystemSettings.AsNoTracking().Where(x => x.Key == SettingKey && x.Scope == SystemSetting.GlobalScope)
                .Select(x => x.Value).FirstOrDefaultAsync(token);
            if (string.IsNullOrWhiteSpace(json)) return SecurityPolicy.Default;
            try { return JsonSerializer.Deserialize<SecurityPolicy>(json, Json) ?? SecurityPolicy.Default; }
            catch (JsonException) { return SecurityPolicy.Default; }
        }, ct);

    public async Task<SecurityPolicy> SaveAsync(int userId, SecurityPolicy policy, CancellationToken ct)
    {
        policy.Validated();
        var row = await db.SystemSettings.FirstOrDefaultAsync(x => x.Key == SettingKey && x.Scope == SystemSetting.GlobalScope, ct);
        if (row is null) db.SystemSettings.Add(row = new SystemSetting { Key = SettingKey, Scope = SystemSetting.GlobalScope, IsPublic = false });
        row.Value = JsonSerializer.Serialize(policy, Json);
        row.UpdatedAtUtc = DateTime.UtcNow;
        row.UpdatedByUserId = userId;
        await db.SaveChangesAsync(ct);
        return policy;
    }

    public async Task EnsureNewPasswordAsync(SysUser user, string? password, CancellationToken ct)
    {
        var policy = await GetAsync(ct);
        policy.EnsurePassword(password);
        if (policy.PasswordHistory <= 0 || user.UserId == 0) return;
        // The current password counts as one of the last N.
        var hashes = new List<string>();
        if (!string.IsNullOrEmpty(user.PasswordHash)) hashes.Add(user.PasswordHash);
        hashes.AddRange(await db.PasswordHistories.AsNoTracking().Where(x => x.UserId == user.UserId).OrderByDescending(x => x.Id)
            .Select(x => x.PasswordHash).Take(Math.Max(policy.PasswordHistory - 1, 0)).ToListAsync(ct));
        if (hashes.Any(hash => passwords.Verify(new SysUser { UserId = user.UserId, UserName = user.UserName, PasswordHash = hash }, password!, out _)))
            throw new BusinessRuleException("security.passwordReused", policy.PasswordHistory);
    }

    public async Task SetPasswordAsync(SysUser user, string password, bool mustChange, CancellationToken ct)
    {
        if (user.UserId != 0 && !string.IsNullOrEmpty(user.PasswordHash))
        {
            db.PasswordHistories.Add(new PasswordHistory { UserId = user.UserId, PasswordHash = user.PasswordHash, CreatedAt = DateTime.UtcNow });
            var old = await db.PasswordHistories.Where(x => x.UserId == user.UserId).OrderByDescending(x => x.Id).Skip(KeptHistory - 1).ToListAsync(ct);
            db.PasswordHistories.RemoveRange(old);
        }
        user.PasswordHash = passwords.Hash(user, password);
        user.PasswordChangedAt = DateTime.UtcNow;
        user.MustChangePassword = mustChange;
    }
}

/// <summary>Writes and reads sys_login_history. A row is saved at once (also when the sign-in fails right after).</summary>
public sealed class LoginHistoryService(CoreContext db, IHttpContextAccessor http, IPermissionService permissions) : ILoginHistoryService
{
    private static string? Cut(string? text, int max) => text is null ? null : text.Length <= max ? text : text[..max];

    public async Task RecordAsync(string userName, int? userId, string? unitCode, string result, CancellationToken ct)
    {
        var context = http.HttpContext;
        db.LoginHistories.Add(new LoginHistory
        {
            LogTime = DateTime.UtcNow, UserName = Cut(userName, 100) ?? string.Empty, UserId = userId, UnitCode = Cut(unitCode, 20),
            IpAddress = Cut(context?.Connection.RemoteIpAddress?.ToString(), 64), UserAgent = Cut(context?.Request.Headers.UserAgent.ToString(), 300),
            Result = result
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<DateTime>> FailuresSinceLastSuccessAsync(string userName, TimeSpan window, CancellationToken ct)
    {
        var since = DateTime.UtcNow - window;
        var lastSuccess = await db.LoginHistories.AsNoTracking().Where(x => x.UserName == userName && x.Result == LoginResults.Success)
            .OrderByDescending(x => x.LogTime).Select(x => (DateTime?)x.LogTime).FirstOrDefaultAsync(ct);
        if (lastSuccess > since) since = lastSuccess.Value;
        return await db.LoginHistories.AsNoTracking()
            .Where(x => x.UserName == userName && x.Result == LoginResults.WrongPassword && x.LogTime > since)
            .Select(x => x.LogTime).ToListAsync(ct);
    }

    private static readonly SortMap<LoginHistory> Sorts = SortMap<LoginHistory>.By(x => x.Id, "time", defaultDescending: true)
        .Add("time", x => x.LogTime).Add("userName", x => x.UserName).Add("result", x => x.Result).Add("unitCode", x => x.UnitCode);

    public async Task<PagedResult<LoginHistoryDto>> QueryAsync(int actorUserId, LoginHistoryQuery query, CancellationToken ct)
    {
        var rows = db.LoginHistories.AsNoTracking();
        // A non-administrator sees the accounts sharing a company unit with them (as in the user list), never unknown user names.
        if (await permissions.VisibleUnitsAsync(actorUserId, ct) is { } units)
        {
            var mine = units.ToList();
            rows = rows.Where(x => x.UserId != null && db.UserCompanyUnits.Any(u => u.UserId == x.UserId && mine.Contains(u.UnitCode)));
        }
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = PagingExtensions.ContainsPattern(query.Search);
            rows = rows.Where(x => SearchFunctions.Matches(x.UserName, pattern) || SearchFunctions.Matches(x.IpAddress, pattern));
        }
        if (!string.IsNullOrWhiteSpace(query.Result)) rows = rows.Where(x => x.Result == query.Result);
        if (query.From is DateOnly from) { var start = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Local).ToUniversalTime(); rows = rows.Where(x => x.LogTime >= start); }
        if (query.To is DateOnly to) { var end = to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Local).ToUniversalTime(); rows = rows.Where(x => x.LogTime < end); }
        var page = await rows.ToPagedAsync(query, Sorts, ct);
        var ids = page.Items.Select(x => x.UserId).OfType<int>().Distinct().ToList();
        var names = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId)).ToDictionaryAsync(x => x.UserId, x => x.FullName, ct);
        return new PagedResult<LoginHistoryDto>(page.Items.Select(x => new LoginHistoryDto(x.Id, x.LogTime, x.UserName,
            x.UserId is int id ? names.GetValueOrDefault(id) : null, x.UnitCode, x.IpAddress, x.UserAgent, x.Result)).ToList(), page.Total, page.Page, page.PageSize);
    }
}

/// <summary>
/// The last activity of each session (one per token), in memory like the notification stream: a session idle longer than the policy allows is
/// refused (401) at its next request. Activity is a sign-in, a unit switch or the heartbeat the browser sends while the user works; the
/// background calls of the screens (notifications, banner) do not count. After a restart the sessions start counting again.
/// </summary>
public sealed class SessionActivity
{
    private readonly ConcurrentDictionary<string, DateTime> _seen = new();
    private readonly ConcurrentDictionary<string, byte> _expired = new();
    private DateTime _nextSweep = DateTime.UtcNow.AddHours(1);

    public void Touch(string sessionId)
    {
        if (string.IsNullOrEmpty(sessionId)) return;
        _seen[sessionId] = DateTime.UtcNow;
        Sweep();
    }

    /// <summary>True when the session has been idle longer than <paramref name="minutes"/>; a session not seen yet starts now.</summary>
    public bool IsIdle(string sessionId, int minutes)
    {
        if (minutes <= 0 || string.IsNullOrEmpty(sessionId)) return false;
        var last = _seen.GetOrAdd(sessionId, _ => DateTime.UtcNow);
        return DateTime.UtcNow - last > TimeSpan.FromMinutes(minutes);
    }

    /// <summary>True the first time a session is found idle (to log it once).</summary>
    public bool MarkExpired(string sessionId) => _expired.TryAdd(sessionId, 0);

    public void End(string sessionId) => _seen.TryRemove(sessionId, out _);

    private void Sweep()
    {
        if (DateTime.UtcNow < _nextSweep) return;
        _nextSweep = DateTime.UtcNow.AddHours(1);
        var cutoff = DateTime.UtcNow.AddDays(-1);
        foreach (var (key, value) in _seen) if (value < cutoff) _seen.TryRemove(key, out _);
        _expired.Clear();
    }
}
