using UnderFit.Domain.Classes;
using Xunit;

namespace UnderFit.UnitTests.Classes;

public sealed class GymClassTests
{
    [Fact]
    public void DeletedClassDoesNotBecomeHeldWhenTimePasses()
    {
        var item = new GymClass("Prueba", new DateOnly(2026, 10, 12), new TimeOnly(10, 0), 60, 10, "Profesor", 1, 2, null, DateTimeOffset.UtcNow);
        item.Delete();
        item.Synchronize(new DateTimeOffset(2026, 10, 13, 12, 0, 0, TimeSpan.Zero));
        Assert.Equal(GymClassStatus.Deleted, item.Status);
    }
    [Fact]
    public void ScheduledClass_TransitionsAutomaticallyFromSchedule()
    {
        var gymClass = new GymClass(
            "Funcional",
            new DateOnly(2026, 7, 28),
            new TimeOnly(18, 0),
            60,
            12,
            "Professor",
            1,
            2,
            null,
            new DateTimeOffset(2026, 7, 28, 12, 0, 0, TimeSpan.Zero));

        gymClass.Synchronize(new DateTimeOffset(2026, 7, 28, 18, 30, 0, TimeSpan.FromHours(-3)));
        Assert.Equal(GymClassStatus.InProgress, gymClass.Status);

        gymClass.Synchronize(new DateTimeOffset(2026, 7, 28, 19, 1, 0, TimeSpan.FromHours(-3)));
        Assert.Equal(GymClassStatus.Held, gymClass.Status);
        Assert.NotNull(gymClass.ActualEndUtc);
    }

    [Fact]
    public void RecurringSchedule_GeneratesOnlySelectedWeekdaysWithinItsRange()
    {
        var schedule = new ClassSchedule(
            "Funcional",
            2,
            1,
            "Professor",
            [1, 3],
            new TimeOnly(18, 0),
            60,
            12,
            new DateOnly(2026, 7, 27),
            new DateOnly(2026, 8, 5),
            null,
            DateTimeOffset.UtcNow);

        var dates = schedule.GenerateDates(
            new DateOnly(2026, 7, 28),
            new DateOnly(2026, 8, 20));

        Assert.Equal(
            [
                new DateOnly(2026, 7, 29),
                new DateOnly(2026, 8, 3),
                new DateOnly(2026, 8, 5),
            ],
            dates);
    }
}
