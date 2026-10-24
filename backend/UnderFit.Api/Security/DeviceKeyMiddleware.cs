using System.Security.Cryptography;
using System.Text;

namespace UnderFit.Api.Security;

public sealed class DeviceKeyMiddleware(RequestDelegate next, IConfiguration configuration)
{
    private readonly byte[] expectedKey = ReadExpectedKey(configuration);
    private readonly IReadOnlyDictionary<string, string?> tabletKeys = configuration
        .GetSection("Authentication:TabletDevices").GetChildren()
        .ToDictionary(item => item.Key, item => item.Value, StringComparer.Ordinal);

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;
        if (path.Equals(new PathString("/api/v1/tablet-pairing/exchange")) && HttpMethods.IsPost(context.Request.Method))
        {
            context.Response.Headers.CacheControl = "no-store";
            await next(context);
            return;
        }
        if (path.StartsWithSegments("/api/v1/tablet"))
        {
            var deviceId = context.Request.Headers["X-UnderFit-Tablet-Id"].ToString();
            var key = context.Request.Headers["X-UnderFit-Tablet-Key"].ToString();
            if (!tabletKeys.TryGetValue(deviceId, out var configured) ||
                string.IsNullOrWhiteSpace(configured) || configured.Length < 32 ||
                !CryptographicOperations.FixedTimeEquals(
                    SHA256.HashData(Encoding.UTF8.GetBytes(configured)),
                    SHA256.HashData(Encoding.UTF8.GetBytes(key))))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new { title = "Esta tablet no está vinculada al gimnasio.", code = "tablet.unauthorized" });
                return;
            }
            context.Items["TabletDeviceId"] = deviceId;
            context.Response.Headers.CacheControl = "no-store";
            await next(context);
            return;
        }
        if (!path.StartsWithSegments("/api/v1") ||
            path.StartsWithSegments("/api/v1/mobile"))
        {
            await next(context);
            return;
        }

        var supplied = context.Request.Headers["X-UnderFit-Device-Key"].ToString();
        var suppliedBytes = Encoding.UTF8.GetBytes(supplied);
        if (suppliedBytes.Length != expectedKey.Length ||
            !CryptographicOperations.FixedTimeEquals(suppliedBytes, expectedKey))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new
            {
                title = "Dispositivo no autorizado.",
                code = "device.unauthorized"
            });
            return;
        }
        await next(context);
    }

    private static byte[] ReadExpectedKey(IConfiguration configuration)
    {
        var value = configuration["Authentication:DeviceKey"];
        if (string.IsNullOrWhiteSpace(value) || Encoding.UTF8.GetByteCount(value) < 32)
            throw new InvalidOperationException(
                "Authentication:DeviceKey with at least 32 bytes is required.");
        return Encoding.UTF8.GetBytes(value);
    }
}
