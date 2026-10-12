using UnderFit.Domain.Members;
using Xunit;

namespace UnderFit.UnitTests.Members;

public sealed class MemberMobileAccountTests
{
    [Fact]
    public void FiveFailedLogins_LockTheAccountForFifteenMinutes()
    {
        var now = new DateTimeOffset(2026, 7, 29, 12, 0, 0, TimeSpan.Zero);
        var account = MemberMobileAccount.Create(
            Guid.NewGuid(),
            new byte[32],
            new byte[24],
            now);

        for (var attempt = 0; attempt < 5; attempt++)
        {
            account.RegisterFailedLogin(now);
        }

        Assert.True(account.IsLocked(now.AddMinutes(14)));
        Assert.False(account.IsLocked(now.AddMinutes(16)));
    }

    [Fact]
    public void ReplacingPassword_InvalidatesExistingAccessTokenVersions()
    {
        var account = MemberMobileAccount.Create(
            Guid.NewGuid(),
            new byte[32],
            new byte[24],
            DateTimeOffset.UtcNow);

        account.ReplacePassword(new byte[32], new byte[24]);

        Assert.Equal(1, account.SessionVersion);
        Assert.True(account.IsActive);
    }

    [Fact]
    public void RefreshToken_CannotBeUsedAfterRevocation()
    {
        var now = new DateTimeOffset(2026, 7, 29, 12, 0, 0, TimeSpan.Zero);
        var token = new MemberRefreshToken(
            Guid.NewGuid(),
            Guid.NewGuid(),
            new byte[32],
            now,
            now.AddDays(30));

        token.Revoke(now.AddMinutes(1));

        Assert.False(token.IsUsable(now.AddMinutes(2)));
    }
}
