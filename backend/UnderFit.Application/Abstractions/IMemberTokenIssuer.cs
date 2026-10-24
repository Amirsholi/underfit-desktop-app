namespace UnderFit.Application.Abstractions;

public interface IMemberTokenIssuer
{
    IssuedMemberAccessToken Issue(Guid memberId, int sessionVersion, DateTimeOffset now);
}

public sealed record IssuedMemberAccessToken(string Value, DateTimeOffset ExpiresAtUtc);
