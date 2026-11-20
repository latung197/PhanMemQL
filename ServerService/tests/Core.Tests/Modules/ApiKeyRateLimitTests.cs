using Core.Application.Modules.ApiClients;
using Xunit;

namespace Core.Tests.Modules;

/// <summary>The per-key call limit: a fixed one-minute window, one counter per API client.</summary>
public sealed class ApiKeyRateLimitTests
{
    private static readonly DateTime Start = new(2027, 3, 1, 8, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void CallsUpToTheLimitPassAndTheNextOneWaits()
    {
        var limit = new ApiKeyRateLimit();
        for (var i = 0; i < 3; i++) Assert.True(limit.TryAcquire("ROBOT", 3, Start.AddSeconds(i), out _));
        Assert.False(limit.TryAcquire("ROBOT", 3, Start.AddSeconds(10), out var retry));
        Assert.Equal(50, retry);   // the window opened at 08:00:00 and ends at 08:01:00
    }

    [Fact]
    public void ANewMinuteStartsANewWindow()
    {
        var limit = new ApiKeyRateLimit();
        for (var i = 0; i < 3; i++) limit.TryAcquire("ROBOT", 3, Start, out _);
        Assert.False(limit.TryAcquire("ROBOT", 3, Start.AddSeconds(59), out _));
        Assert.True(limit.TryAcquire("ROBOT", 3, Start.AddSeconds(60), out _));
    }

    [Fact]
    public void EachClientHasItsOwnCounter()
    {
        var limit = new ApiKeyRateLimit();
        for (var i = 0; i < 2; i++) limit.TryAcquire("A", 2, Start, out _);
        Assert.False(limit.TryAcquire("A", 2, Start, out _));
        Assert.True(limit.TryAcquire("B", 2, Start, out _));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void ZeroSwitchesTheLimitOff(int configured)
    {
        var limit = new ApiKeyRateLimit();
        for (var i = 0; i < 10_000; i++) Assert.True(limit.TryAcquire("ROBOT", configured, Start, out _));
    }

    [Fact]
    public async Task ManyCallsAtOnceNeverPassTheLimit()
    {
        var limit = new ApiKeyRateLimit();
        var passed = 0;
        await Task.WhenAll(Enumerable.Range(0, 400).Select(_ => Task.Run(() =>
        {
            if (limit.TryAcquire("ROBOT", 100, Start, out _)) Interlocked.Increment(ref passed);
        })));
        Assert.Equal(100, passed);
    }
}
