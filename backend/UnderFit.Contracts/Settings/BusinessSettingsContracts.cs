namespace UnderFit.Contracts.Settings;

public sealed record RunningEventSettingsResponse(
    bool EventoRunningActivo, string EventoRunningNombre,
    string EventoRunningDistancias, DateOnly EventoRunningFecha, string EventoRunningLeyenda = "ya falta menos");

public sealed record UpdateRunningEventSettingsRequest(
    bool EventoRunningActivo, string EventoRunningNombre,
    string EventoRunningDistancias, DateOnly EventoRunningFecha, string? EventoRunningLeyenda = null);
