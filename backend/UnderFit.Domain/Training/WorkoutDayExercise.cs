using UnderFit.Domain.Common;

namespace UnderFit.Domain.Training;

public sealed class WorkoutDayExercise
{
    private WorkoutDayExercise()
    {
    }

    public WorkoutDayExercise(
        Guid id,
        Guid workoutDayId,
        int exerciseId,
        int position,
        int sets,
        string repetitions,
        string? load,
        int? restSeconds,
        string? notes)
    {
        if (position < 1 || sets < 1 || sets > 20)
            throw new DomainException("Exercise position and sets are invalid.");
        var normalizedRepetitions = repetitions?.Trim() ?? string.Empty;
        if (normalizedRepetitions.Length is < 1 or > 80)
            throw new DomainException("Repetitions must contain between 1 and 80 characters.");
        if (restSeconds is < 0 or > 3600)
            throw new DomainException("Rest seconds are invalid.");
        Id = id;
        WorkoutDayId = workoutDayId;
        ExerciseId = exerciseId;
        Position = position;
        Sets = sets;
        Repetitions = normalizedRepetitions;
        Load = Normalize(load, 80);
        RestSeconds = restSeconds;
        Notes = Normalize(notes, 500);
    }

    public Guid Id { get; private set; }
    public Guid WorkoutDayId { get; private set; }
    public WorkoutDay WorkoutDay { get; private set; } = null!;
    public int ExerciseId { get; private set; }
    public Exercise Exercise { get; private set; } = null!;
    public int Position { get; private set; }
    public int Sets { get; private set; }
    public string Repetitions { get; private set; } = string.Empty;
    public string? Load { get; private set; }
    public int? RestSeconds { get; private set; }
    public string? Notes { get; private set; }

    private static string? Normalize(string? value, int max)
    {
        var normalized = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (normalized?.Length > max) throw new DomainException("Exercise assignment value is too long.");
        return normalized;
    }
}
