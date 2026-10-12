using UnderFit.Domain.Common;

namespace UnderFit.Domain.Classes;

public sealed class ClassSchedule
{
    private ClassSchedule() { }

    public ClassSchedule(
        string name,
        int locationId,
        int professorId,
        string professorName,
        IEnumerable<int> weekdays,
        TimeOnly time,
        int durationMinutes,
        int capacity,
        DateOnly startsOn,
        DateOnly? endsOn,
        string? notes,
        DateTimeOffset createdAtUtc)
    {
        var normalizedDays = weekdays.Distinct().Order().ToArray();
        if (string.IsNullOrWhiteSpace(name)) throw new DomainException("Class name is required.");
        if (locationId <= 0) throw new DomainException("Location is invalid.");
        if (professorId <= 0 || string.IsNullOrWhiteSpace(professorName)) throw new DomainException("Professor is required.");
        if (normalizedDays.Length == 0 || normalizedDays.Any(day => day is < 0 or > 6))
            throw new DomainException("At least one valid weekday is required.");
        if (durationMinutes <= 0 || capacity <= 0) throw new DomainException("Duration and capacity must be positive.");
        if (endsOn < startsOn) throw new DomainException("Schedule end cannot precede its start.");
        Name = name.Trim();
        LocationId = locationId;
        ProfessorId = professorId;
        ProfessorName = professorName.Trim();
        Weekdays = string.Join(',', normalizedDays);
        Time = time;
        DurationMinutes = durationMinutes;
        Capacity = capacity;
        StartsOn = startsOn;
        EndsOn = endsOn;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        CreatedAtUtc = createdAtUtc;
        UpdatedAtUtc = createdAtUtc;
        IsActive = true;
    }

    public int Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public int LocationId { get; private set; }
    public int ProfessorId { get; private set; }
    public string ProfessorName { get; private set; } = string.Empty;
    public string Weekdays { get; private set; } = string.Empty;
    public TimeOnly Time { get; private set; }
    public int DurationMinutes { get; private set; }
    public int Capacity { get; private set; }
    public DateOnly StartsOn { get; private set; }
    public DateOnly? EndsOn { get; private set; }
    public string? Notes { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public bool IsTrial { get; private set; }

    public void MarkAsTrial(bool value) => IsTrial = value;

    public void Update(string name, int professorId, string professorName, IEnumerable<int> weekdays,
        TimeOnly time, int duration, int capacity, DateOnly? endsOn, string? notes, bool trial, DateTimeOffset now)
    {
        var validated = new ClassSchedule(name, LocationId, professorId, professorName, weekdays,
            time, duration, capacity, StartsOn, endsOn, notes, CreatedAtUtc);
        Name = validated.Name; ProfessorId = validated.ProfessorId; ProfessorName = validated.ProfessorName;
        Weekdays = validated.Weekdays; Time = validated.Time; DurationMinutes = validated.DurationMinutes;
        Capacity = validated.Capacity; EndsOn = validated.EndsOn; Notes = validated.Notes;
        IsTrial = trial; UpdatedAtUtc = now;
    }

    public IReadOnlyList<DateOnly> GenerateDates(DateOnly from, DateOnly through)
    {
        var days = Weekdays.Split(',').Select(int.Parse).ToHashSet();
        var first = from > StartsOn ? from : StartsOn;
        var last = EndsOn is not null && EndsOn < through ? EndsOn.Value : through;
        var result = new List<DateOnly>();
        for (var date = first; date <= last; date = date.AddDays(1))
        {
            if (days.Contains((int)date.DayOfWeek)) result.Add(date);
        }
        return result;
    }
}
