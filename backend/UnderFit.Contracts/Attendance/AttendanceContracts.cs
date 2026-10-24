namespace UnderFit.Contracts.Attendance;

public sealed record RegisterEntryRequest(
    string IdentityNumber,
    string Source,
    string? DeviceId,
    DateTimeOffset? OccurredAtUtc,
    string? Observation = null,
    int LocationId = 1,
    int? ClassId = null);

public sealed record EntryResponse(
    Guid EntryId,
    Guid MemberId,
    string MemberName,
    DateOnly MembershipExpiresOn,
    int DaysRemaining,
    DateTimeOffset OccurredAtUtc);

public sealed record EntryListItemResponse(
    Guid Id,
    DateOnly Date,
    TimeOnly Time,
    string IdentityNumber,
    string MemberName,
    string Source,
    string? Observation,
    int LocationId,
    string? DeviceId,
    int? ClassId);

public sealed record AnnulEntryRequest(string Reason);
public sealed record AnnulEntryResponse(bool Annulled, Guid Id);
