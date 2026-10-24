using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using UnderFit.Api.Security;
using Xunit;

namespace UnderFit.IntegrationTests;

public sealed class TabletAccessTests
{
    [Theory]
    [InlineData("/api/v1/tablet/session", "tablet1", "one", 200)]
    [InlineData("/api/v1/tablet/state", "tablet2", "two", 200)]
    [InlineData("/api/v1/tablet/state", "tablet1", "two", 401)]
    [InlineData("/api/v1/tablet/state", "unknown", "one", 401)]
    [InlineData("/api/v1/settings/business", "tablet1", "one", 401)]
    [InlineData("/api/v1/products/pending-sales", "tablet2", "two", 401)]
    [InlineData("/api/v1/admin/tablets/tablet2/pairing-code", "tablet2", "two", 401)]
    public async Task TabletKeysAreBoundToDeviceAndCannotAccessAdministration(string path, string device, string key, int status)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Authentication:DeviceKey"] = new('a', 64),
            ["Authentication:TabletDevices:tablet1"] = new('1', 64),
            ["Authentication:TabletDevices:tablet2"] = new('2', 64),
        }).Build();
        var invoked = false;
        var middleware = new DeviceKeyMiddleware(_ => { invoked = true; return Task.CompletedTask; }, configuration);
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        context.Request.Path = path;
        context.Request.Headers["X-UnderFit-Tablet-Id"] = device;
        context.Request.Headers["X-UnderFit-Tablet-Key"] = new string(key == "one" ? '1' : '2', 64);
        await middleware.InvokeAsync(context);
        Assert.Equal(status, context.Response.StatusCode);
        Assert.Equal(status == 200, invoked);
        if (invoked) Assert.Equal(device, context.Items["TabletDeviceId"]);
    }
}
