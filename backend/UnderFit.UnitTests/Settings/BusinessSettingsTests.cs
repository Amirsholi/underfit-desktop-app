using UnderFit.Domain.Common;
using UnderFit.Domain.Settings;
using Xunit;

namespace UnderFit.UnitTests.Settings;

public sealed class BusinessSettingsTests
{
    [Fact]
    public void EventLegend_IsEditableAndPreservedForOlderClients()
    {
        var settings = new BusinessSettings(true, "Encuentro", "En familia", new DateOnly(2026, 12, 12), " ¡Te esperamos! ");
        Assert.Equal("¡Te esperamos!", settings.RunningEventLegend);
        settings.Update(false, "Encuentro", "Todos invitados", new DateOnly(2026, 12, 20));
        Assert.Equal("¡Te esperamos!", settings.RunningEventLegend);
        Assert.Throws<DomainException>(() => settings.Update(true, "Encuentro", "Todos", new DateOnly(2026, 12, 20), " "));
    }

    [Fact]
    public void RunningEvent_CanRemainEnabledAfterItsConfiguredDate()
    {
        var settings = new BusinessSettings(
            true, "UNDER RUNNING", "3KM & 5KM", new DateOnly(2026, 5, 24));

        Assert.True(settings.RunningEventActive);
    }

    [Fact]
    public void RunningEvent_RequiresNameAndDistances()
    {
        Assert.Throws<DomainException>(() =>
            new BusinessSettings(true, "", "5KM", new DateOnly(2026, 9, 20)));
        Assert.Throws<DomainException>(() =>
            new BusinessSettings(true, "Carrera", "", new DateOnly(2026, 9, 20)));
    }
}
