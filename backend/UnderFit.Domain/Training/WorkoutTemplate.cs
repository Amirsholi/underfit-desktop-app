using UnderFit.Domain.Common;

namespace UnderFit.Domain.Training;

public sealed class WorkoutTemplate
{
    private WorkoutTemplate() { }

    public WorkoutTemplate(string name, string daysJson, DateTimeOffset createdAtUtc)
    {
        Update(name, daysJson, true);
        CreatedAtUtc = createdAtUtc;
    }

    public int Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string DaysJson { get; private set; } = "[]";
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public int? ProfessorId { get; private set; }
    public void SetProfessor(int? id)
    {
        if (id is <= 0) throw new DomainException("Professor is invalid.");
        ProfessorId = id;
    }

    public void Update(string name, string daysJson, bool isActive)
    {
        var normalizedName = name?.Trim() ?? string.Empty;
        if (normalizedName.Length is < 2 or > 160)
            throw new DomainException("Workout template name must contain between 2 and 160 characters.");
        if (string.IsNullOrWhiteSpace(daysJson) || daysJson == "[]")
            throw new DomainException("Workout template needs at least one grouping.");
        Name = normalizedName;
        DaysJson = daysJson;
        IsActive = isActive;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}
