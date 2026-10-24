using System.Security.Cryptography;

namespace UnderFit.Api.Tablet;

public sealed class TabletPairingService(IConfiguration configuration, TimeProvider clock)
{
    private sealed record Grant(string Code, DateTimeOffset ExpiresAt, int Attempts = 0);
    private readonly Dictionary<string, Grant> grants = new(StringComparer.Ordinal);
    private readonly object gate = new();

    public PairingCode? Create(string deviceId)
    {
        if (deviceId is not ("tablet1" or "tablet2") ||
            configuration[$"Authentication:TabletDevices:{deviceId}"] is not { Length: >= 32 }) return null;
        lock (gate)
        {
            var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            var expires = clock.GetUtcNow().AddMinutes(5);
            grants[deviceId] = new Grant(code, expires);
            return new PairingCode(deviceId, code, expires);
        }
    }

    public TabletCredential? Exchange(string deviceId, string code)
    {
        lock (gate)
        {
            if (!grants.TryGetValue(deviceId, out var grant)) return null;
            if (grant.ExpiresAt <= clock.GetUtcNow() || grant.Attempts >= 5)
            {
                grants.Remove(deviceId);
                return null;
            }
            if (code != grant.Code)
            {
                grants[deviceId] = grant with { Attempts = grant.Attempts + 1 };
                return null;
            }
            grants.Remove(deviceId);
            return new TabletCredential(deviceId, configuration[$"Authentication:TabletDevices:{deviceId}"]!);
        }
    }
}

public sealed record PairingCode(string DeviceId, string Code, DateTimeOffset ExpiresAt);
public sealed record TabletCredential(string Id, string Key);
public sealed record ExchangeTabletCode(string DeviceId, string Code);
