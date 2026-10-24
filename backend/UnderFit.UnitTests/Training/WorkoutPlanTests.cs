using UnderFit.Domain.Training;
using Xunit;

namespace UnderFit.UnitTests.Training;

public sealed class WorkoutPlanTests
{
    [Fact]
    public void DayAcceptsMissingGroupBeforeDerivingItFromExercises()
    {
        var day = new WorkoutDay(Guid.NewGuid(), Guid.NewGuid(), 1, "Día 1", "");
        day.SetMuscleGroups("Espalda");
        Assert.Equal("Espalda", day.MuscleGroups);
    }
    [Fact]
    public void WorkoutDay_IsAnOrderedGroupingAndDoesNotRequireACalendarDate()
    {
        var day = new WorkoutDay(
            Guid.NewGuid(),
            Guid.NewGuid(),
            2,
            "Día B",
            "Espalda y bíceps");

        Assert.Equal(2, day.Position);
        Assert.Equal("Espalda y bíceps", day.MuscleGroups);
    }

    [Fact]
    public void Assignment_PreservesTheProfessorsRepetitionText()
    {
        var assignment = new WorkoutDayExercise(
            Guid.NewGuid(),
            Guid.NewGuid(),
            8,
            1,
            4,
            "12 / 10 / 8 / 8",
            "Progresivo",
            90,
            "Cuidar la técnica");

        Assert.Equal(4, assignment.Sets);
        Assert.Equal("12 / 10 / 8 / 8", assignment.Repetitions);
        Assert.Equal("Progresivo", assignment.Load);
    }

    [Fact]
    public void CatalogExercise_KeepsMuscleGroupAndGif()
    {
        var exercise = Exercise.Create(
            "Remo con barra",
            "Espalda",
            "Mantener la espalda neutra.",
            "https://media.underfit.uy/exercises/remo-barra.gif");

        Assert.Equal("Espalda", exercise.MuscleGroup);
        Assert.EndsWith(".gif", exercise.GifUrl);
        Assert.True(exercise.IsActive);
    }
}
