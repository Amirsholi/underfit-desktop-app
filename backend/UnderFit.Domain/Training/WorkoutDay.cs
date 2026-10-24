using UnderFit.Domain.Common;

namespace UnderFit.Domain.Training;

public sealed class WorkoutDay
{
    private WorkoutDay()
    {
    }

    public WorkoutDay(Guid id, Guid workoutPlanId, int position, string name, string muscleGroups)
    {
        if (position < 1) throw new DomainException("Workout day position must be positive.");
        Id = id;
        WorkoutPlanId = workoutPlanId;
        Position = position;
        Name = Require(name, 100, "Workout day name");
        SetMuscleGroups(muscleGroups);
    }

    public Guid Id { get; private set; }
    public Guid WorkoutPlanId { get; private set; }
    public WorkoutPlan WorkoutPlan { get; private set; } = null!;
    public int Position { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string MuscleGroups { get; private set; } = string.Empty;
    public List<WorkoutDayExercise> Exercises { get; private set; } = [];

    public void SetMuscleGroups(string? value)
    {
        var normalized = value?.Trim() ?? string.Empty;
        if (normalized.Length > 250) throw new DomainException("Muscle groups must contain at most 250 characters.");
        MuscleGroups = normalized;
    }

    private static string Require(string value, int max, string label)
    {
        var normalized = value?.Trim() ?? string.Empty;
        if (normalized.Length is < 2 || normalized.Length > max)
            throw new DomainException($"{label} must contain between 2 and {max} characters.");
        return normalized;
    }
}
