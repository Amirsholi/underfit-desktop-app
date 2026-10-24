using UnderFit.Domain.Common;
using UnderFit.Domain.Members;
using UnderFit.Domain.Staff;

namespace UnderFit.Domain.Training;

public sealed class WorkoutPlan
{
    private WorkoutPlan()
    {
    }

    private WorkoutPlan(Guid memberId, string name, int professorId, DateTimeOffset createdAtUtc)
    {
        Id = Guid.NewGuid();
        MemberId = memberId;
        Name = RequireName(name);
        ProfessorId = professorId;
        CreatedAtUtc = createdAtUtc;
        IsActive = true;
    }

    public Guid Id { get; private set; }
    public Guid MemberId { get; private set; }
    public Member Member { get; private set; } = null!;
    public string Name { get; private set; } = string.Empty;
    public int ProfessorId { get; private set; }
    public Professor Professor { get; private set; } = null!;
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset? FinishedAtUtc { get; private set; }
    public List<WorkoutDay> Days { get; private set; } = [];

    public static WorkoutPlan Create(Guid memberId, string name, int professorId, DateTimeOffset createdAtUtc) =>
        new(memberId, name, professorId, createdAtUtc);

    public void Finish(DateTimeOffset now)
    {
        IsActive = false;
        FinishedAtUtc = now;
    }

    private static string RequireName(string value)
    {
        var normalized = value?.Trim() ?? string.Empty;
        if (normalized.Length is < 2 or > 160)
            throw new DomainException("Workout plan name must contain between 2 and 160 characters.");
        return normalized;
    }
}
