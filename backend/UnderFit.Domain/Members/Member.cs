using UnderFit.Domain.Common;

namespace UnderFit.Domain.Members;

public sealed class Member
{
    private Member()
    {
    }

    private Member(string identityNumber, string name, DateOnly membershipExpiresOn)
    {
        Id = Guid.NewGuid();
        IdentityNumber = NormalizeIdentity(identityNumber);
        Name = RequireName(name);
        MembershipExpiresOn = membershipExpiresOn;
        CreatedAtUtc = DateTimeOffset.UtcNow;
    }

    public Guid Id { get; private set; }
    public string IdentityNumber { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Phone { get; private set; }
    public string? Email { get; private set; }
    public string? Details { get; private set; }
    public string? EmergencyContactName { get; private set; }
    public string? EmergencyContactPhone { get; private set; }
    public bool ImageUseAuthorized { get; private set; }
    public DateOnly? BirthDate { get; private set; }
    public string? Address { get; private set; }
    public string? EmergencyRelationship { get; private set; }
    public string? MedicalCondition { get; private set; }
    public string? Goal { get; private set; }
    public string? RegistrationPaymentMethod { get; private set; }
    public string? PaymentPreference { get; private set; }
    public MembershipPlan CurrentMembershipPlan { get; private set; }
    public DateOnly MembershipExpiresOn { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    public static Member Create(
        string identityNumber,
        string name,
        MembershipPlan plan,
        DateOnly startsOn,
        MemberProfile? profile = null)
    {
        var member = new Member(identityNumber, name, plan.CalculateExpiration(startsOn));
        member.CurrentMembershipPlan = plan;
        member.UpdatedAtUtc = member.CreatedAtUtc;
        if (profile is not null)
        {
            member.UpdateProfile(name, profile, member.CreatedAtUtc);
        }
        return member;
    }

    public bool CanEnterOn(DateOnly date) => MembershipExpiresOn >= date;

    public int DaysRemainingOn(DateOnly date) =>
        Math.Max(0, MembershipExpiresOn.DayNumber - date.DayNumber);

    public MembershipRenewal Renew(
        MembershipPlan plan,
        DateOnly paidOn,
        DateTimeOffset? renewedAtUtc = null)
    {
        var previousExpiration = MembershipExpiresOn;
        var renewalStart = previousExpiration >= paidOn ? previousExpiration : paidOn;
        CurrentMembershipPlan = plan;
        MembershipExpiresOn = plan.CalculateExpiration(renewalStart);
        UpdatedAtUtc = renewedAtUtc ?? DateTimeOffset.UtcNow;

        return new MembershipRenewal(
            Guid.NewGuid(),
            Id,
            plan,
            paidOn,
            previousExpiration,
            MembershipExpiresOn);
    }

    public void UpdateMembershipManually(
        MembershipPlan plan,
        int daysRemaining,
        DateOnly effectiveOn,
        DateTimeOffset updatedAtUtc)
    {
        if (daysRemaining is < 0 or > 3660)
        {
            throw new DomainException("Days remaining must be between 0 and 3660.");
        }

        CurrentMembershipPlan = plan;
        MembershipExpiresOn = effectiveOn.AddDays(daysRemaining);
        UpdatedAtUtc = updatedAtUtc;
    }

    public void UpdateProfile(string name, MemberProfile profile, DateTimeOffset updatedAtUtc)
    {
        Name = RequireName(name);
        Phone = NormalizeOptional(profile.Phone);
        Email = NormalizeOptional(profile.Email);
        Details = NormalizeOptional(profile.Details);
        EmergencyContactName = NormalizeOptional(profile.EmergencyContactName);
        EmergencyContactPhone = NormalizeOptional(profile.EmergencyContactPhone);
        ImageUseAuthorized = profile.ImageUseAuthorized;
        BirthDate = profile.BirthDate;
        Address = NormalizeOptional(profile.Address);
        EmergencyRelationship = NormalizeOptional(profile.EmergencyRelationship);
        MedicalCondition = NormalizeOptional(profile.MedicalCondition);
        Goal = NormalizeOptional(profile.Goal);
        RegistrationPaymentMethod = NormalizeOptional(profile.RegistrationPaymentMethod);
        PaymentPreference = NormalizeOptional(profile.PaymentPreference);
        UpdatedAtUtc = updatedAtUtc;
    }

    private static string NormalizeIdentity(string value)
    {
        var normalized = value?.Trim() ?? string.Empty;
        if (normalized.Length is < 1 or > 32)
        {
            throw new DomainException("Identity number must contain between 1 and 32 characters.");
        }

        return normalized;
    }

    private static string RequireName(string value)
    {
        var name = value?.Trim() ?? string.Empty;
        if (name.Length is < 2 or > 160)
        {
            throw new DomainException("Member name must contain between 2 and 160 characters.");
        }

        return name;
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
