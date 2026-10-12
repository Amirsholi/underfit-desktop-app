using UnderFit.Domain.Common;

namespace UnderFit.Domain.Training;

public sealed class Exercise
{
    private Exercise()
    {
    }

    private Exercise(string name, string muscleGroup, string? instructions, string? gifUrl)
    {
        Name = Require(name, 160, "Exercise name");
        MuscleGroup = Require(muscleGroup, 100, "Muscle group");
        Instructions = Optional(instructions, 1000, "Instructions");
        GifUrl = Optional(gifUrl, 500, "GIF URL");
        IsActive = true;
    }

    public int Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string MuscleGroup { get; private set; } = string.Empty;
    public string? Instructions { get; private set; }
    public string? GifUrl { get; private set; }
    public bool IsActive { get; private set; }

    public static Exercise Create(string name, string muscleGroup, string? instructions, string? gifUrl) =>
        new(name, muscleGroup, instructions, gifUrl);

    public void Update(string name, string muscleGroup, string? instructions, string? gifUrl, bool isActive)
    {
        Name = Require(name, 160, "Exercise name");
        MuscleGroup = Require(muscleGroup, 100, "Muscle group");
        Instructions = Optional(instructions, 1000, "Instructions");
        GifUrl = Optional(gifUrl, 500, "GIF URL");
        IsActive = isActive;
    }

    private static string Require(string value, int max, string label)
    {
        var normalized = value?.Trim() ?? string.Empty;
        if (normalized.Length is < 2 || normalized.Length > max)
            throw new DomainException($"{label} must contain between 2 and {max} characters.");
        return normalized;
    }

    private static string? Optional(string? value, int max, string label)
    {
        var normalized = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (normalized?.Length > max) throw new DomainException($"{label} is too long.");
        return normalized;
    }
}
