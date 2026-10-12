namespace UnderFit.Domain.Members;

public sealed class MemberRefreshToken
{
    private MemberRefreshToken()
    {
    }

    public MemberRefreshToken(
        Guid id,
        Guid memberId,
        byte[] tokenHash,
        DateTimeOffset createdAtUtc,
        DateTimeOffset expiresAtUtc)
    {
        Id = id;
        MemberId = memberId;
        TokenHash = tokenHash;
        CreatedAtUtc = createdAtUtc;
        ExpiresAtUtc = expiresAtUtc;
    }

    public Guid Id { get; private set; }
    public Guid MemberId { get; private set; }
    public MemberMobileAccount Account { get; private set; } = null!;
    public byte[] TokenHash { get; private set; } = [];
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset ExpiresAtUtc { get; private set; }
    public DateTimeOffset? RevokedAtUtc { get; private set; }

    public bool IsUsable(DateTimeOffset now) => RevokedAtUtc is null && ExpiresAtUtc > now;

    public void Revoke(DateTimeOffset now) => RevokedAtUtc ??= now;
}
