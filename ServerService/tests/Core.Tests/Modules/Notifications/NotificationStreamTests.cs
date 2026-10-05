using Core.Application.Modules.Notifications;
using Core.Infrastructure.Modules.Notifications;
using Xunit;

namespace Core.Tests.Modules.Notifications;

public sealed class NotificationStreamTests
{
    private static List<string> Drain(NotificationSubscription s)
    {
        var events = new List<string>();
        while (s.Events.TryRead(out var e)) events.Add(e);
        return events;
    }

    [Fact]
    public void SignalsOnlyTabsThatCanSeeTheNotification()
    {
        var stream = new NotificationStream();
        using var a1 = stream.Subscribe(1, "DVCS01");
        using var b1 = stream.Subscribe(2, "DVCS01");
        using var c2 = stream.Subscribe(3, "DVCS02");

        stream.Publish("DVCS01", null);     // whole unit
        stream.Publish(null, 3);            // one person, any unit
        stream.Publish("DVCS01", 2);        // one person in a unit

        Assert.Equal([NotificationStreamEvents.Notification], Drain(a1));
        Assert.Equal([NotificationStreamEvents.Notification, NotificationStreamEvents.Notification], Drain(b1));
        Assert.Equal([NotificationStreamEvents.Notification], Drain(c2));
    }

    [Fact]
    public void SyncGoesToEveryTabOfTheUserAndClosedTabsAreRemoved()
    {
        var stream = new NotificationStream();
        using var tab1 = stream.Subscribe(1, "DVCS01");
        var tab2 = stream.Subscribe(1, "DVCS02");
        using var other = stream.Subscribe(2, "DVCS01");

        stream.SyncUser(1);
        Assert.Equal([NotificationStreamEvents.Sync], Drain(tab1));
        Assert.Equal([NotificationStreamEvents.Sync], Drain(tab2));
        Assert.Empty(Drain(other));

        tab2.Dispose();
        Assert.Equal(2, stream.Count);
        Assert.True(tab2.Events.Completion.IsCompleted);
    }

    [Fact]
    public void SettingsSignalGoesToEveryTab()
    {
        var stream = new NotificationStream();
        using var a = stream.Subscribe(1, "DVCS01");
        using var b = stream.Subscribe(2, "DVCS02");

        stream.PublishSettings();

        Assert.Equal([NotificationStreamEvents.Settings], Drain(a));
        Assert.Equal([NotificationStreamEvents.Settings], Drain(b));
    }

    [Fact]
    public void SlowTabKeepsOnlyTheLatestSignals()
    {
        var stream = new NotificationStream();
        using var tab = stream.Subscribe(1, "DVCS01");
        for (var i = 0; i < 50; i++) stream.Publish(null, null);
        Assert.InRange(Drain(tab).Count, 1, 8);
    }
}
