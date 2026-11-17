using System.Collections.Concurrent;

namespace Core.Application.Modules.ApiClients;

/// <summary>
/// A fixed-window counter per API client: at most <c>limit</c> calls in each minute (kept in memory like the idle sessions, so single
/// instance only). A robot that loops on an error cannot flood the system; the login limit of 10 a minute does not apply to keys.
/// 0 switches the limit off.
/// </summary>
public sealed class ApiKeyRateLimit
{
    private sealed class Window(DateTime start)
    {
        public DateTime Start = start;
        public int Count;
    }

    private readonly ConcurrentDictionary<string, Window> _windows = new(StringComparer.Ordinal);

    /// <returns>True when the call may go on; otherwise false and the seconds to wait for the next window.</returns>
    public bool TryAcquire(string client, int limit, DateTime nowUtc, out int retryAfterSeconds)
    {
        retryAfterSeconds = 0;
        if (limit <= 0) return true;
        var window = _windows.GetOrAdd(client, _ => new Window(nowUtc));
        lock (window)
        {
            if (nowUtc - window.Start >= TimeSpan.FromMinutes(1))
            {
                window.Start = nowUtc;
                window.Count = 0;
            }
            if (window.Count >= limit)
            {
                retryAfterSeconds = Math.Max(1, (int)Math.Ceiling((window.Start.AddMinutes(1) - nowUtc).TotalSeconds));
                return false;
            }
            window.Count++;
            return true;
        }
    }
}
