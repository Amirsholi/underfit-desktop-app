namespace UnderFit.Contracts.Mobile;

public sealed record MemberAccountDeletionRequestResponse(
    Guid Id,
    string MemberIdentityNumber,
    string MemberName,
    DateTimeOffset RequestedAtUtc,
    string Status,
    DateTimeOffset? ResolvedAtUtc,
    string? ResolutionNote);

public sealed record ResolveMemberAccountDeletionRequest(
    bool Completed,
    string? Note);
