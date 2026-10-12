using UnderFit.Application.Abstractions;
using UnderFit.Application.Common;
using UnderFit.Contracts.Training;
using UnderFit.Domain.Training;
using System.Text.Json;

namespace UnderFit.Application.Training;

public sealed class TrainingService(IUnderFitDataStore dataStore, TimeProvider timeProvider)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public async Task<IReadOnlyList<ExerciseResponse>> ListExercisesAsync(
        bool includeInactive,
        CancellationToken cancellationToken) =>
        (await dataStore.ListExercisesAsync(includeInactive, cancellationToken))
        .Select(Map)
        .ToArray();

    public async Task<ExerciseResponse> CreateExerciseAsync(
        CreateExerciseRequest request,
        CancellationToken cancellationToken)
    {
        var exercise = Exercise.Create(
            request.Name,
            request.MuscleGroup,
            request.Instructions,
            request.GifUrl);
        dataStore.AddExercise(exercise);
        await dataStore.SaveChangesAsync(cancellationToken);
        return Map(exercise);
    }

    public async Task<ExerciseResponse> UpdateExerciseAsync(
        int exerciseId,
        UpdateExerciseRequest request,
        CancellationToken cancellationToken)
    {
        var exercise = await dataStore.FindExerciseAsync(exerciseId, cancellationToken)
            ?? throw new UseCaseException("exercise.not_found", "Exercise not found.");
        exercise.Update(
            request.Name,
            request.MuscleGroup,
            request.Instructions,
            request.GifUrl,
            request.IsActive);
        await dataStore.SaveChangesAsync(cancellationToken);
        return Map(exercise);
    }

    public async Task<WorkoutPlanResponse> AssignPlanAsync(
        string identityNumber,
        AssignWorkoutPlanRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Days.Count == 0)
            throw new UseCaseException("workout_plan.days_required", "The plan needs at least one day.");
        var member = await dataStore.FindMemberByIdentityAsync(identityNumber, cancellationToken)
            ?? throw new UseCaseException("member.not_found", "Member not found.");
        var professor = await dataStore.FindProfessorAsync(request.ProfessorId, cancellationToken)
            ?? throw new UseCaseException("professor.not_found", "Professor not found.");
        var now = timeProvider.GetUtcNow();
        var current = await dataStore.FindActiveWorkoutPlanAsync(member.Id, cancellationToken);
        var retainedExercises = current?.Days.SelectMany(day => day.Exercises)
            .Select(item => item.ExerciseId).ToHashSet() ?? [];
        current?.Finish(now);

        var plan = WorkoutPlan.Create(member.Id, request.Name, professor.Id, now);
        foreach (var requestedDay in request.Days.OrderBy(item => item.Position))
        {
            var groups = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var day = new WorkoutDay(
                Guid.NewGuid(),
                plan.Id,
                requestedDay.Position,
                requestedDay.Name,
                requestedDay.MuscleGroups);
            foreach (var requestedExercise in requestedDay.Exercises.OrderBy(item => item.Position))
            {
                var exercise = await dataStore.FindExerciseAsync(
                    requestedExercise.ExerciseId,
                    cancellationToken);
                if (exercise is null || (!exercise.IsActive && !retainedExercises.Contains(exercise.Id)))
                    throw new UseCaseException("exercise.not_found", "An assigned exercise is unavailable.");
                groups.Add(exercise.MuscleGroup);
                day.Exercises.Add(new WorkoutDayExercise(
                    Guid.NewGuid(),
                    day.Id,
                    exercise.Id,
                    requestedExercise.Position,
                    requestedExercise.Sets,
                    requestedExercise.Repetitions,
                    requestedExercise.Load,
                    requestedExercise.RestSeconds,
                    requestedExercise.Notes));
            }
            if (day.Exercises.Count == 0)
                throw new UseCaseException("workout_day.exercises_required", "Every day needs exercises.");
            if (string.IsNullOrWhiteSpace(requestedDay.MuscleGroups))
            {
                var label = string.Join(", ", groups);
                day.SetMuscleGroups(label.Length <= 250 ? label : "Varios grupos musculares");
            }
            plan.Days.Add(day);
        }
        dataStore.AddWorkoutPlan(plan);
        await dataStore.SaveChangesAsync(cancellationToken);
        return (await dataStore.FindActiveWorkoutPlanAsync(member.Id, cancellationToken) is { } stored)
            ? Map(stored)
            : throw new UseCaseException("workout_plan.not_found", "Workout plan not found.");
    }

    public async Task<WorkoutPlanResponse?> GetActivePlanAsync(
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var plan = await dataStore.FindActiveWorkoutPlanAsync(memberId, cancellationToken);
        return plan is null ? null : Map(plan);
    }

    public async Task<IReadOnlyList<MemberWorkoutPlanResponse>> ListActiveMemberPlansAsync(
        CancellationToken cancellationToken) =>
        (await dataStore.ListActiveWorkoutPlansAsync(cancellationToken))
        .Select(plan => new MemberWorkoutPlanResponse(
            plan.Member.IdentityNumber,
            plan.Member.Name,
            plan.CreatedAtUtc,
            Map(plan)))
        .ToArray();

    public async Task<IReadOnlyList<WorkoutTemplateResponse>> ListTemplatesAsync(
        CancellationToken cancellationToken) =>
        (await dataStore.ListWorkoutTemplatesAsync(cancellationToken))
        .Select(Map)
        .ToArray();

    public async Task<WorkoutTemplateResponse> SaveTemplateAsync(
        SaveWorkoutTemplateRequest request,
        CancellationToken cancellationToken)
    {
        ValidateDays(request.Days);
        var template = new WorkoutTemplate(
            request.Name,
            JsonSerializer.Serialize(request.Days, JsonOptions),
            timeProvider.GetUtcNow());
        if (request.ProfessorId is not null)
        {
            var professor = await dataStore.FindProfessorAsync(request.ProfessorId.Value, cancellationToken);
            if (professor is null || !professor.IsActive) throw new UseCaseException("staff.not_found", "El profesor no está disponible.");
        }
        template.SetProfessor(request.ProfessorId);
        dataStore.AddWorkoutTemplate(template);
        await dataStore.SaveChangesAsync(cancellationToken);
        return Map(template);
    }

    private static ExerciseResponse Map(Exercise item) =>
        new(item.Id, item.Name, item.MuscleGroup, item.Instructions, item.GifUrl, item.IsActive);

    private static WorkoutPlanResponse Map(WorkoutPlan plan) =>
        new(
            plan.Id,
            plan.Name,
            plan.ProfessorId,
            plan.Professor.Name,
            plan.Days.OrderBy(day => day.Position).Select(day =>
                new WorkoutDayResponse(
                    day.Id,
                    day.Position,
                    day.Name,
                    day.MuscleGroups,
                    day.Exercises.OrderBy(item => item.Position).Select(item =>
                        new WorkoutExerciseResponse(
                            item.Id,
                            item.ExerciseId,
                            item.Position,
                            item.Exercise.Name,
                            item.Exercise.MuscleGroup,
                            item.Exercise.Instructions,
                            item.Exercise.GifUrl,
                            item.Sets,
                            item.Repetitions,
                            item.Load,
                            item.RestSeconds,
                            item.Notes)).ToArray())).ToArray());

    private static WorkoutTemplateResponse Map(WorkoutTemplate template) =>
        new(
            template.Id,
            template.Name,
            JsonSerializer.Deserialize<IReadOnlyList<AssignWorkoutDayRequest>>(
                template.DaysJson, JsonOptions) ?? [],
            template.IsActive, template.ProfessorId);

    private static void ValidateDays(IReadOnlyList<AssignWorkoutDayRequest> days)
    {
        if (days.Count == 0 || days.Any(day => day.Exercises.Count == 0))
            throw new UseCaseException(
                "workout_template.invalid",
                "Every template needs at least one grouping with exercises.");
    }
}
