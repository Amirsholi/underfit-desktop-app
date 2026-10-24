using System.Data;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using UnderFit.Infrastructure.Persistence;

namespace UnderFit.Api.Security;

public sealed class IdempotencyMiddleware(RequestDelegate next, TimeProvider timeProvider)
{
    private const string HeaderName = "Idempotency-Key";

    public async Task InvokeAsync(HttpContext context, UnderFitDbContext database)
    {
        if (!RequiresIdempotency(context.Request))
        {
            await next(context);
            return;
        }

        var key = context.Request.Headers[HeaderName].ToString().Trim();
        if (key.Length is < 8 or > 100)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new
            {
                title = "La operación necesita una clave de idempotencia válida.",
                code = "idempotency.key_required"
            });
            return;
        }

        context.Request.EnableBuffering();
        var requestHash = await HashRequestAsync(context.Request, context.RequestAborted);
        var scope = $"{context.Request.Method}:{context.Request.Path.Value}";
        if (context.Items["TabletDeviceId"] is string tabletId) scope = $"tablet:{tabletId}:{scope}";

        await using var transaction = await database.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            context.RequestAborted);

        var previous = await database.IdempotentRequests
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.Scope == scope && item.Key == key,
                context.RequestAborted);

        if (previous is not null)
        {
            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.ASCII.GetBytes(previous.RequestHash),
                    Encoding.ASCII.GetBytes(requestHash)))
            {
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                await context.Response.WriteAsJsonAsync(new
                {
                    title = "La clave ya fue usada para una operación diferente.",
                    code = "idempotency.key_reused"
                });
                return;
            }

            context.Response.StatusCode = previous.ResponseStatus;
            if (!string.IsNullOrWhiteSpace(previous.ResponseContentType))
                context.Response.ContentType = previous.ResponseContentType;
            context.Response.Headers["Idempotency-Replayed"] = "true";
            await context.Response.WriteAsync(previous.ResponseBody, context.RequestAborted);
            await transaction.CommitAsync(context.RequestAborted);
            return;
        }

        var originalBody = context.Response.Body;
        await using var capturedBody = new MemoryStream();
        context.Response.Body = capturedBody;
        try
        {
            await next(context);
            capturedBody.Position = 0;
            var responseBody = await new StreamReader(capturedBody, Encoding.UTF8)
                .ReadToEndAsync(context.RequestAborted);

            if (context.Response.StatusCode is >= 200 and < 300)
            {
                database.IdempotentRequests.Add(new IdempotentRequest(
                    scope,
                    key,
                    requestHash,
                    context.Response.StatusCode,
                    context.Response.ContentType,
                    responseBody,
                    timeProvider.GetUtcNow()));
                await database.SaveChangesAsync(context.RequestAborted);
            }

            await transaction.CommitAsync(context.RequestAborted);
            context.Response.Body = originalBody;
            await context.Response.WriteAsync(responseBody, context.RequestAborted);
        }
        finally
        {
            context.Response.Body = originalBody;
        }
    }

    private static bool RequiresIdempotency(HttpRequest request)
    {
        var path = request.Path.Value ?? string.Empty;
        if (path.StartsWith("/api/v1/tablet/", StringComparison.OrdinalIgnoreCase))
            return !HttpMethods.IsGet(request.Method) && !HttpMethods.IsHead(request.Method) &&
                !path.Equals("/api/v1/tablet/media", StringComparison.OrdinalIgnoreCase);
        var mobileBooking =
            (HttpMethods.IsPost(request.Method) || HttpMethods.IsDelete(request.Method)) &&
            path.StartsWith("/api/v1/mobile/classes/", StringComparison.OrdinalIgnoreCase) &&
            path.EndsWith("/enrollment", StringComparison.OrdinalIgnoreCase);
        if (mobileBooking) return true;
        if (!HttpMethods.IsPost(request.Method)) return false;
        return path.Equals("/api/v1/classes/attendance", StringComparison.OrdinalIgnoreCase) ||
               path.Equals("/api/v1/products/pending-sales", StringComparison.OrdinalIgnoreCase) ||
               path.StartsWith("/api/v1/products/pending-sales/", StringComparison.OrdinalIgnoreCase) &&
               path.EndsWith("/collection", StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<string> HashRequestAsync(
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        hash.AppendData(Encoding.UTF8.GetBytes($"{request.Method}:{request.Path.Value}{request.QueryString}:"));
        await using var body = new MemoryStream();
        await request.Body.CopyToAsync(body, cancellationToken);
        hash.AppendData(body.GetBuffer().AsSpan(0, checked((int)body.Length)));
        request.Body.Position = 0;
        return Convert.ToHexString(hash.GetHashAndReset());
    }
}
