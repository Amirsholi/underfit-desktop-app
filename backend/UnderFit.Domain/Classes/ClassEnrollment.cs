using UnderFit.Domain.Common;

namespace UnderFit.Domain.Classes;

public sealed class ClassEnrollment
{
    private ClassEnrollment() { }

    private ClassEnrollment(
        int? classId,
        int? scheduleId,
        Guid memberId,
        string memberIdentityNumber,
        string memberName,
        DateOnly effectiveFrom,
        DateTimeOffset createdAtUtc,
        string origin)
    {
        if ((classId is null) == (scheduleId is null))
            throw new DomainException("Enrollment must target one class or one schedule.");
        Id = Guid.NewGuid();
        ClassId = classId;
        ScheduleId = scheduleId;
        MemberId = memberId;
        MemberIdentityNumber = memberIdentityNumber;
        MemberName = memberName;
        EffectiveFrom = effectiveFrom;
        CreatedAtUtc = createdAtUtc;
        Origin = string.IsNullOrWhiteSpace(origin) ? "administration" : origin.Trim();
        IsActive = true;
    }

    public Guid Id { get; private set; }
    public int? ClassId { get; private set; }
    public int? ScheduleId { get; private set; }
    public Guid? MemberId { get; private set; }
    public string MemberIdentityNumber { get; private set; } = string.Empty;
    public string MemberName { get; private set; } = string.Empty;
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateOnly EffectiveFrom { get; private set; }
    public DateOnly? EffectiveUntil { get; private set; }
    public DateTimeOffset? EndedAtUtc { get; private set; }
    public string Origin { get; private set; } = "administration";

    public static ClassEnrollment Create(
        GymClass gymClass,
        Guid memberId,
        string identityNumber,
        string memberName,
        DateTimeOffset createdAtUtc) =>
        new(
            gymClass.ScheduleId is null ? gymClass.Id : null,
            gymClass.ScheduleId,
            memberId,
            identityNumber,
            memberName,
            gymClass.Date,
            createdAtUtc,
            "administration");

    public static ClassEnrollment CreateOccurrence(
        GymClass gymClass,
        Guid memberId,
        string identityNumber,
        string memberName,
        DateTimeOffset createdAtUtc,
        string origin) =>
        new(
            gymClass.Id,
            null,
            memberId,
            identityNumber,
            memberName,
            gymClass.Date,
            createdAtUtc,
            origin);

    public void EndBefore(DateOnly occurrenceDate, DateTimeOffset endedAtUtc)
    {
        if (!IsActive) throw new DomainException("Enrollment is already inactive.");
        EffectiveUntil = occurrenceDate.AddDays(-1);
        EndedAtUtc = endedAtUtc;
        IsActive = false;
    }
}
