namespace UnderFit.Application.Common;

public sealed class UseCaseException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
