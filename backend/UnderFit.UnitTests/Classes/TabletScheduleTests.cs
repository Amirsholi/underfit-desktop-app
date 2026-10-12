using UnderFit.Domain.Classes;
using UnderFit.Domain.Common;
using Xunit;

namespace UnderFit.UnitTests.Classes;

public sealed class TabletScheduleTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 23, 12, 0, 0, TimeSpan.FromHours(-3));
    private static ClassSchedule Schedule(TimeOnly time) => new("Nuevo nombre", 2, 1, "Profesor", [3], time, 60, 12,
        new DateOnly(2026, 9, 1), null, null, Now.AddDays(-7));
    private static GymClass Occurrence(TimeOnly time) => new("Nombre original", new DateOnly(2026, 9, 23), time, 45, 10,
        "Profesor", 1, 2, null, Now.AddDays(-7));

    [Fact]
    public void EditingScheduleCannotRewritePastAttendanceClass()
    {
        var item = Occurrence(new TimeOnly(10, 0));
        Assert.Throws<DomainException>(() => item.UpdateFromSchedule(Schedule(new TimeOnly(15, 0)), Now));
        Assert.Equal("Nombre original", item.Name);
        Assert.Equal(new TimeOnly(10, 0), item.Time);
    }

    [Fact]
    public void MovingFutureClassIntoPastCancelsInsteadOfFabricatingHeldClass()
    {
        var item = Occurrence(new TimeOnly(15, 0));
        item.UpdateFromSchedule(Schedule(new TimeOnly(10, 0)), Now);
        Assert.Equal(GymClassStatus.Cancelled, item.Status);
        Assert.Equal(new TimeOnly(15, 0), item.Time);
    }

    [Fact]
    public void FutureOccurrenceReceivesTrialFlagWithoutChangingItsDate()
    {
        var schedule = Schedule(new TimeOnly(16, 0));
        schedule.MarkAsTrial(true);
        var item = Occurrence(new TimeOnly(15, 0));
        item.UpdateFromSchedule(schedule, Now);
        Assert.True(item.IsTrial);
        Assert.Equal(new TimeOnly(16, 0), item.Time);
        Assert.Equal(new DateOnly(2026, 9, 23), item.Date);
    }
}
