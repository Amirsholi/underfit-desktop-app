using UnderFit.Domain.Common;

namespace UnderFit.Domain.Members;

public sealed class MemberAccountDeletionRequest
{
    private MemberAccountDeletionRequest() { }

    public MemberAccountDeletionRequest(
        Guid memberId,
        string memberIdentityNumber,
        string memberName,
        DateTimeOffset requestedAtUtc)
    {
        if (memberId == Guid.Empty || string.IsNullOrWhiteSpace(memberIdentityNumber))
            throw new DomainException("Account deletion request references are invalid.");
        Id = Guid.NewGuid();
        MemberId = memberId;
        MemberIdentityNumber = memberIdentityNumber.Trim();
        MemberName = memberName.Trim();
        RequestedAtUtc = requestedAtUtc;
        Status = MemberAccountDeletionStatus.Pending;
    }

    public Guid Id { get; private set; }
    public Guid? MemberId { get; private set; }
    public string MemberIdentityNumber { get; private set; } = string.Empty;
    public string MemberName { get; private set; } = string.Empty;
    public DateTimeOffset RequestedAtUtc { get; private set; }
    public MemberAccountDeletionStatus Status { get; private set; }
    public DateTimeOffset? ResolvedAtUtc { get; private set; }
    public string? ResolutionNote { get; private set; }

    public void Resolve(bool completed, string? note, DateTimeOffset resolvedAtUtc)
    {
        if (Status != MemberAccountDeletionStatus.Pending)
            throw new DomainException("The account deletion request is already resolved.");
        Status = completed
            ? MemberAccountDeletionStatus.Completed
            : MemberAccountDeletionStatus.Rejected;
        ResolutionNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        ResolvedAtUtc = resolvedAtUtc;
    }
}

public enum MemberAccountDeletionStatus
{
    Pending,
    Completed,
    Rejected
}
