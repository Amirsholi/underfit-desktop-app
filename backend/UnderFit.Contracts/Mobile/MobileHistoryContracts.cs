namespace UnderFit.Contracts.Mobile;

public sealed record MemberMobileHistoryResponse(
    IReadOnlyList<MemberMobileEntryResponse> Entries,
    IReadOnlyList<MemberMobileRenewalResponse> Renewals);

public sealed record MemberMobileEntryResponse(
    Guid Id,
    DateTimeOffset OccurredAtUtc,
    string Source,
    int LocationId,
    string LocationName,
    int? ClassId,
    string? Observation,
    int? PerformanceRating,
    DateTimeOffset? RatedAtUtc);

public sealed record MemberMobileRenewalResponse(
    Guid Id,
    string Plan,
    DateOnly PaidOn,
    decimal Amount,
    string PaymentMethod,
    DateOnly NewExpiration);
