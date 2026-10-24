using UnderFit.Application.Abstractions;
using UnderFit.Contracts.Settings;
using UnderFit.Domain.Settings;

namespace UnderFit.Application.Settings;

public sealed class BusinessSettingsService(IUnderFitDataStore dataStore)
{
    public async Task<RunningEventSettingsResponse> GetAsync(CancellationToken ct)
    {
        var settings = await dataStore.GetBusinessSettingsAsync(ct);
        return settings is null ? Defaults() : Map(settings);
    }

    public async Task<RunningEventSettingsResponse> UpdateAsync(
        UpdateRunningEventSettingsRequest request, CancellationToken ct)
    {
        var settings = await dataStore.GetBusinessSettingsAsync(ct);
        if (settings is null)
        {
            settings = new BusinessSettings(
                request.EventoRunningActivo, request.EventoRunningNombre,
                request.EventoRunningDistancias, request.EventoRunningFecha, request.EventoRunningLeyenda);
            dataStore.AddBusinessSettings(settings);
        }
        else
        {
            settings.Update(
                request.EventoRunningActivo, request.EventoRunningNombre,
                request.EventoRunningDistancias, request.EventoRunningFecha, request.EventoRunningLeyenda);
        }
        await dataStore.SaveChangesAsync(ct);
        return Map(settings);
    }

    private static RunningEventSettingsResponse Defaults() =>
        new(false, "UNDER RUNNING", "3KM & 5KM", new DateOnly(2026, 5, 24));

    private static RunningEventSettingsResponse Map(BusinessSettings settings) =>
        new(settings.RunningEventActive, settings.RunningEventName,
            settings.RunningEventDistances, settings.RunningEventDate, settings.RunningEventLegend);
}
