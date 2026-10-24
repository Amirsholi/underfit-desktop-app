using UnderFit.Domain.Common;

namespace UnderFit.Domain.Classes;

public sealed class ClassEnrollmentException
{
    private ClassEnrollmentException() { }

    public ClassEnrollmentException(
        int classId,
        Guid memberId,
        string memberIdentityNumber,
        string memberName,
        string origin,
        DateTimeOffset createdAtUtc)
    {
        if (classId <= 0) throw new DomainException("Class is invalid.");
        Id = Guid.NewGuid();
        ClassId = classId;
        MemberId = memberId;
        MemberIdentityNumber = memberIdentityNumber.Trim();
        MemberName = memberName.Trim();
        Origin = string.IsNullOrWhiteSpace(origin) ? "mobile" : origin.Trim();
        CreatedAtUtc = createdAtUtc;
    }

    public Guid Id { get; private set; }
    public int ClassId { get; private set; }
    public Guid? MemberId { get; private set; }
    public string MemberIdentityNumber { get; private set; } = string.Empty;
    public string MemberName { get; private set; } = string.Empty;
    public string Origin { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; private set; }
}
