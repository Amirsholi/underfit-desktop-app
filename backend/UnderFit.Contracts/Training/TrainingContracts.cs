namespace UnderFit.Contracts.Training;

public sealed record CreateExerciseRequest(
    string Name,
    string MuscleGroup,
    string? Instructions,
    string? GifUrl);

public sealed record UpdateExerciseRequest(
    string Name,
    string MuscleGroup,
    string? Instructions,
    string? GifUrl,
    bool IsActive);

public sealed record ExerciseResponse(
    int Id,
    string Name,
    string MuscleGroup,
    string? Instructions,
    string? GifUrl,
    bool IsActive);

public sealed record AssignWorkoutPlanRequest(
    string Name,
    int ProfessorId,
    IReadOnlyList<AssignWorkoutDayRequest> Days,
    string? ProfessorName = null);

public sealed record AssignWorkoutDayRequest(
    int Position,
    string Name,
    string MuscleGroups,
    IReadOnlyList<AssignWorkoutExerciseRequest> Exercises);

public sealed record AssignWorkoutExerciseRequest(
    int ExerciseId,
    int Position,
    int Sets,
    string Repetitions,
    string? Load,
    int? RestSeconds,
    string? Notes);

public sealed record SaveWorkoutTemplateRequest(
    string Name,
    IReadOnlyList<AssignWorkoutDayRequest> Days,
    int? ProfessorId = null,
    string? ProfessorName = null);

public sealed record WorkoutTemplateResponse(
    int Id,
    string Name,
    IReadOnlyList<AssignWorkoutDayRequest> Days,
    bool IsActive,
    int? ProfessorId = null);

public sealed record WorkoutPlanResponse(
    Guid Id,
    string Name,
    int ProfessorId,
    string ProfessorName,
    IReadOnlyList<WorkoutDayResponse> Days);

public sealed record MemberWorkoutPlanResponse(
    string IdentityNumber,
    string MemberName,
    DateTimeOffset AssignedAtUtc,
    WorkoutPlanResponse Plan);

public sealed record WorkoutDayResponse(
    Guid Id,
    int Position,
    string Name,
    string MuscleGroups,
    IReadOnlyList<WorkoutExerciseResponse> Exercises);

public sealed record WorkoutExerciseResponse(
    Guid Id,
    int ExerciseId,
    int Position,
    string Name,
    string MuscleGroup,
    string? Instructions,
    string? GifUrl,
    int Sets,
    string Repetitions,
    string? Load,
    int? RestSeconds,
    string? Notes);
