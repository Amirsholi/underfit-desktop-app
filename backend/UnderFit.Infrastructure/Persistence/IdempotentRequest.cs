namespace UnderFit.Infrastructure.Persistence;

public sealed class IdempotentRequest
{
    private IdempotentRequest() { }

    public IdempotentRequest(
        string scope,
        string key,
        string requestHash,
        int responseStatus,
        string? responseContentType,
        string responseBody,
        DateTimeOffset createdAtUtc)
    {
        Scope = scope;
        Key = key;
        RequestHash = requestHash;
        ResponseStatus = responseStatus;
        ResponseContentType = responseContentType;
        ResponseBody = responseBody;
        CreatedAtUtc = createdAtUtc;
    }

    public string Scope { get; private set; } = string.Empty;
    public string Key { get; private set; } = string.Empty;
    public string RequestHash { get; private set; } = string.Empty;
    public int ResponseStatus { get; private set; }
    public string? ResponseContentType { get; private set; }
    public string ResponseBody { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; private set; }
}
