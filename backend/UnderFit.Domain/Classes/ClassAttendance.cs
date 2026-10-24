using UnderFit.Domain.Common;

namespace UnderFit.Domain.Classes;

public sealed class ClassAttendance
{
    private ClassAttendance() { }
    public ClassAttendance(
        int classId, int? scheduleId, Guid memberId, string identityNumber,
        string memberName, Guid entryId, int locationId, int professorId,
        int? professorSessionId, string deviceId, DateTimeOffset occurredAtUtc)
    {
        if (classId <= 0 || locationId <= 0 || professorId <= 0 ||
            professorSessionId is <= 0)
            throw new DomainException("Class attendance references are invalid.");
        Id=Guid.NewGuid(); ClassId=classId; ScheduleId=scheduleId; MemberId=memberId;
        MemberIdentityNumber=identityNumber; MemberName=memberName; EntryId=entryId;
        LocationId=locationId; ProfessorId=professorId; ProfessorSessionId=professorSessionId;
        DeviceId=deviceId; OccurredAtUtc=occurredAtUtc;
    }
    public Guid Id {get;private set;}
    public int ClassId {get;private set;}
    public int? ScheduleId {get;private set;}
    public Guid? MemberId {get;private set;}
    public string MemberIdentityNumber {get;private set;}="";
    public string MemberName {get;private set;}="";
    public Guid EntryId {get;private set;}
    public int LocationId {get;private set;}
    public int ProfessorId {get;private set;}
    public int? ProfessorSessionId {get;private set;}
    public string DeviceId {get;private set;}="";
    public DateTimeOffset OccurredAtUtc {get;private set;}
    public bool IsAnnulled {get;private set;}
    public int? PerformanceRating {get;private set;}
    public int? RatedByProfessorId {get;private set;}
    public DateTimeOffset? RatedAtUtc {get;private set;}

    public DateTimeOffset? AnnulledAtUtc {get;private set;}
    public string? AnnulmentReason {get;private set;}

    public void Annul(string reason, DateTimeOffset annulledAtUtc)
    {
        if (IsAnnulled) throw new DomainException("Attendance is already annulled.");
        if (string.IsNullOrWhiteSpace(reason)) throw new DomainException("Annulment reason is required.");
        IsAnnulled = true;
        AnnulledAtUtc = annulledAtUtc;
        AnnulmentReason = reason.Trim();
    }

    public void SetPerformanceRating(int score, int professorId, DateTimeOffset ratedAtUtc)
    {
        if (IsAnnulled) throw new DomainException("Annulled attendance cannot be rated.");
        if (score is < 1 or > 5) throw new DomainException("Performance rating must be between 1 and 5.");
        if (professorId <= 0) throw new DomainException("Professor is invalid.");
        PerformanceRating = score;
        RatedByProfessorId = professorId;
        RatedAtUtc = ratedAtUtc;
    }
}
