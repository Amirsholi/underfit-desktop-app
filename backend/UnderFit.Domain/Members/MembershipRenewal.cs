namespace UnderFit.Domain.Members;

public sealed record MembershipRenewal(
    Guid Id,
    Guid? MemberId,
    MembershipPlan Plan,
    DateOnly PaidOn,
    DateOnly PreviousExpiration,
    DateOnly NewExpiration,
    string MemberName = "",
    DateTimeOffset PaidAtUtc = default,
    decimal Amount = 0,
    string PaymentMethod = "efectivo",
    Guid? CashSessionId = null,
    Guid? CashMovementId = null,
    string? Notes = null);
