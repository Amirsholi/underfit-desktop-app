using UnderFit.Domain.Members;
using Xunit;

namespace UnderFit.UnitTests.Members;

public sealed class MemberTests
{
    [Theory]
    [InlineData(MembershipPlan.Monthly, 30)]
    [InlineData(MembershipPlan.Quarterly, 90)]
    [InlineData(MembershipPlan.Semiannual, 180)]
    public void Create_UsesExistingFixedDayMembershipRules(MembershipPlan plan, int expectedDays)
    {
        var startsOn = new DateOnly(2026, 7, 27);

        var member = Member.Create("01234567", "Ada Lovelace", plan, startsOn);

        Assert.Equal(startsOn.AddDays(expectedDays), member.MembershipExpiresOn);
        Assert.Equal(plan, member.CurrentMembershipPlan);
    }

    [Fact]
    public void CanEnterOn_AllowsExpirationDay()
    {
        var member = Member.Create(
            "12345678",
            "Grace Hopper",
            MembershipPlan.Monthly,
            new DateOnly(2026, 6, 27));

        Assert.True(member.CanEnterOn(member.MembershipExpiresOn));
    }

    [Fact]
    public void Renew_ActiveMembershipExtendsFromCurrentExpiration()
    {
        var member = Member.Create(
            "12345678",
            "Grace Hopper",
            MembershipPlan.Monthly,
            new DateOnly(2026, 7, 1));

        var previousExpiration = member.MembershipExpiresOn;
        var renewal = member.Renew(MembershipPlan.Monthly, new DateOnly(2026, 7, 20));

        Assert.Equal(previousExpiration, renewal.PreviousExpiration);
        Assert.Equal(previousExpiration.AddDays(30), renewal.NewExpiration);
    }

    [Fact]
    public void Renew_ExpiredMembershipExtendsFromPaymentDate()
    {
        var member = Member.Create(
            "12345678",
            "Grace Hopper",
            MembershipPlan.Monthly,
            new DateOnly(2026, 5, 1));
        var paidOn = new DateOnly(2026, 7, 27);

        var renewal = member.Renew(MembershipPlan.Quarterly, paidOn);

        Assert.Equal(paidOn.AddDays(90), renewal.NewExpiration);
    }

    [Fact]
    public void IdentityNumber_RemainsTextAndPreservesLeadingZeroes()
    {
        var member = Member.Create(
            "01234567",
            "Katherine Johnson",
            MembershipPlan.Monthly,
            new DateOnly(2026, 7, 27));

        Assert.Equal("01234567", member.IdentityNumber);
    }

    [Fact]
    public void ManualEdit_RecalculatesExpirationFromEffectiveDate()
    {
        var member = Member.Create(
            "12345678",
            "Dorothy Vaughan",
            MembershipPlan.Monthly,
            new DateOnly(2026, 7, 1));
        var effectiveOn = new DateOnly(2026, 7, 27);

        member.UpdateMembershipManually(
            MembershipPlan.Semiannual,
            12,
            effectiveOn,
            new DateTimeOffset(2026, 7, 27, 15, 0, 0, TimeSpan.Zero));

        Assert.Equal(MembershipPlan.Semiannual, member.CurrentMembershipPlan);
        Assert.Equal(effectiveOn.AddDays(12), member.MembershipExpiresOn);
    }
}
