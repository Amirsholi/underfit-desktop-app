using UnderFit.Domain.Common;

namespace UnderFit.Domain.Classes;

public sealed class GymClass
{
    private GymClass() { }

    public GymClass(
        string name,
        DateOnly date,
        TimeOnly time,
        int durationMinutes,
        int capacity,
        string professorName,
        int? professorId,
        int locationId,
        string? notes,
        DateTimeOffset createdAtUtc)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new DomainException("Class name is required.");
        if (durationMinutes <= 0) throw new DomainException("Class duration must be positive.");
        if (capacity <= 0) throw new DomainException("Class capacity must be positive.");
        if (string.IsNullOrWhiteSpace(professorName)) throw new DomainException("Professor is required.");
        if (locationId <= 0) throw new DomainException("Location is invalid.");
        Name = name.Trim();
        Date = date;
        Time = time;
        DurationMinutes = durationMinutes;
        Capacity = capacity;
        ProfessorName = professorName.Trim();
        ProfessorId = professorId;
        LocationId = locationId;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        CreatedAtUtc = createdAtUtc;
        Status = GymClassStatus.Scheduled;
    }

    public int Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public DateOnly Date { get; private set; }
    public TimeOnly Time { get; private set; }
    public int DurationMinutes { get; private set; }
    public int Capacity { get; private set; }
    public string ProfessorName { get; private set; } = string.Empty;
    public int? ProfessorId { get; private set; }
    public int LocationId { get; private set; }
    public string? Notes { get; private set; }
    public GymClassStatus Status { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset? ActualStartUtc { get; private set; }
    public DateTimeOffset? ActualEndUtc { get; private set; }
    public int? ScheduleId { get; private set; }
    public bool IsTrial { get; private set; }
    public ClassSchedule? Schedule { get; private set; }

    public void AssignSchedule(ClassSchedule schedule)
    {
        Schedule = schedule ?? throw new DomainException("Schedule is invalid.");
    }

    public void Synchronize(DateTimeOffset localNow)
    {
        if (Status is GymClassStatus.Cancelled or GymClassStatus.Held or GymClassStatus.Deleted) return;
        var start = new DateTimeOffset(Date.ToDateTime(Time), localNow.Offset);
        var end = start.AddMinutes(DurationMinutes);
        if (localNow >= end)
        {
            Status = GymClassStatus.Held;
            ActualStartUtc ??= start.ToUniversalTime();
            ActualEndUtc ??= end.ToUniversalTime();
        }
        else if (localNow >= start)
        {
            Status = GymClassStatus.InProgress;
            ActualStartUtc ??= start.ToUniversalTime();
        }
    }

    public void CorrectHeldStatus(bool held)
    {
        if (Status is not (GymClassStatus.Held or GymClassStatus.Cancelled))
            throw new DomainException("Class result can only be corrected after it finishes.");
        Status = held ? GymClassStatus.Held : GymClassStatus.Cancelled;
    }

    public void MarkAsTrial(bool isTrial) => IsTrial = isTrial;

    public void Delete() => Status = GymClassStatus.Deleted;

    public void UpdateFromSchedule(ClassSchedule schedule, DateTimeOffset now)
    {
        if (Status == GymClassStatus.Deleted) return;
        if (new DateTimeOffset(Date.ToDateTime(Time), now.Offset) <= now)
            throw new DomainException("Past or running classes cannot be rescheduled.");
        if (!schedule.GenerateDates(Date, Date).Contains(Date)) { Status = GymClassStatus.Cancelled; return; }
        // If the new start is already past, cancel this future occurrence rather
        // than fabricating an already-held class with the new time.
        if (new DateTimeOffset(Date.ToDateTime(schedule.Time), now.Offset) <= now) { Status = GymClassStatus.Cancelled; return; }
        Name = schedule.Name; Time = schedule.Time; DurationMinutes = schedule.DurationMinutes;
        Capacity = schedule.Capacity; ProfessorName = schedule.ProfessorName; ProfessorId = schedule.ProfessorId;
        Notes = schedule.Notes; IsTrial = schedule.IsTrial; Status = GymClassStatus.Scheduled;
    }
}

public enum GymClassStatus { Scheduled, InProgress, Held, Cancelled, Deleted }
