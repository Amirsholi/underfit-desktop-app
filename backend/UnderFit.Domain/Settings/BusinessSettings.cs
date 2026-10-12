using UnderFit.Domain.Common;

namespace UnderFit.Domain.Settings;

public sealed class BusinessSettings
{
    public const int SingletonId = 1;
    private BusinessSettings() { }

    public BusinessSettings(bool active, string name, string distances, DateOnly date, string? legend = null)
    {
        Id = SingletonId;
        Update(active, name, distances, date, legend);
    }

    public int Id { get; private set; }
    public bool RunningEventActive { get; private set; }
    public string RunningEventName { get; private set; } = string.Empty;
    public string RunningEventDistances { get; private set; } = string.Empty;
    public DateOnly RunningEventDate { get; private set; }
    public string RunningEventLegend { get; private set; } = "ya falta menos";

    public void Update(bool active, string name, string distances, DateOnly date, string? legend = null)
    {
        name = (name ?? string.Empty).Trim();
        distances = (distances ?? string.Empty).Trim();
        if (name.Length == 0) throw new DomainException("Nombre del evento obligatorio");
        if (distances.Length == 0) throw new DomainException("Subtítulo del evento obligatorio");
        legend = (legend ?? RunningEventLegend).Trim();
        if (legend.Length == 0 || legend.Length > 160) throw new DomainException("La leyenda debe tener entre 1 y 160 caracteres");
        RunningEventLegend = legend;
        RunningEventActive = active;
        RunningEventName = name;
        RunningEventDistances = distances;
        RunningEventDate = date;
    }
}
