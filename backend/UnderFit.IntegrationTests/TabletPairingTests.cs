using Microsoft.Extensions.Configuration;
using UnderFit.Api.Tablet;
using Xunit;

namespace UnderFit.IntegrationTests;

public sealed class TabletPairingTests
{
    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => Now;
    }
    private static TabletPairingService Create(TimeProvider clock) => new(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Authentication:TabletDevices:tablet1"] = new('1', 64),
            ["Authentication:TabletDevices:tablet2"] = new('2', 64),
        }).Build(), clock);

    [Fact]
    public void CodeIsBoundToDeviceAndSingleUse()
    {
        var service = Create(TimeProvider.System);
        var grant = service.Create("tablet1")!;
        Assert.Matches("^[0-9]{6}$", grant.Code);
        Assert.Null(service.Exchange("tablet2", grant.Code));
        Assert.Equal(new string('1', 64), service.Exchange("tablet1", grant.Code)!.Key);
        Assert.Null(service.Exchange("tablet1", grant.Code));
        Assert.Null(service.Create("other-device"));
    }

    [Fact]
    public void ExpirationAndFiveFailedAttemptsRequireANewCode()
    {
        var clock = new Clock(); var service = Create(clock);
        var expired = service.Create("tablet1")!;
        clock.Now = clock.Now.AddMinutes(5);
        Assert.Null(service.Exchange("tablet1", expired.Code));
        var blocked = service.Create("tablet1")!;
        for (var i = 0; i < 5; i++) Assert.Null(service.Exchange("tablet1", "wrong"));
        Assert.Null(service.Exchange("tablet1", blocked.Code));
        var fresh = service.Create("tablet1")!;
        Assert.NotNull(service.Exchange("tablet1", fresh.Code));
    }
}
