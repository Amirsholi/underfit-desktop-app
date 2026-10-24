using UnderFit.Domain.Common;

namespace UnderFit.Domain.Members;

public sealed class MemberMobileAccount
{
    private MemberMobileAccount()
    {
    }

    private MemberMobileAccount(Guid memberId, byte[] passwordHash, byte[] passwordSalt, DateTimeOffset createdAtUtc)
    {
        MemberId = memberId;
        PasswordHash = passwordHash;
        PasswordSalt = passwordSalt;
        CreatedAtUtc = createdAtUtc;
        IsActive = true;
    }

    public Guid MemberId { get; private set; }
    public Member Member { get; private set; } = null!;
    public byte[] PasswordHash { get; private set; } = [];
    public byte[] PasswordSalt { get; private set; } = [];
    public bool IsActive { get; private set; }
    public int FailedLoginAttempts { get; private set; }
    public DateTimeOffset? LockedUntilUtc { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset? LastLoginAtUtc { get; private set; }
    public int SessionVersion { get; private set; }

    public static MemberMobileAccount Create(
        Guid memberId,
        byte[] passwordHash,
        byte[] passwordSalt,
        DateTimeOffset createdAtUtc)
    {
        if (passwordHash.Length < 32 || passwordSalt.Length < 16)
        {
            throw new DomainException("Mobile credentials are invalid.");
        }

        return new MemberMobileAccount(memberId, passwordHash, passwordSalt, createdAtUtc);
    }

    public bool IsLocked(DateTimeOffset now) => LockedUntilUtc > now;

    public void RegisterFailedLogin(DateTimeOffset now)
    {
        FailedLoginAttempts++;
        if (FailedLoginAttempts >= 5)
        {
            LockedUntilUtc = now.AddMinutes(15);
            FailedLoginAttempts = 0;
        }
    }

    public void RegisterSuccessfulLogin(DateTimeOffset now)
    {
        FailedLoginAttempts = 0;
        LockedUntilUtc = null;
        LastLoginAtUtc = now;
    }

    public void ReplacePassword(byte[] passwordHash, byte[] passwordSalt)
    {
        if (passwordHash.Length < 32 || passwordSalt.Length < 16)
        {
            throw new DomainException("Mobile credentials are invalid.");
        }

        PasswordHash = passwordHash;
        PasswordSalt = passwordSalt;
        FailedLoginAttempts = 0;
        LockedUntilUtc = null;
        SessionVersion++;
        IsActive = true;
    }

    public void Deactivate()
    {
        IsActive = false;
        SessionVersion++;
    }
}
