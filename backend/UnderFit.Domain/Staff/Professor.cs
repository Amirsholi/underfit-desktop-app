using UnderFit.Domain.Common;

namespace UnderFit.Domain.Staff;

public sealed class Professor
{
    private Professor() { }
    public Professor(string name, string pinHash, string pinSalt, DateTimeOffset now)
    {
        Rename(name); PinHash = pinHash; PinSalt = pinSalt;
        IsActive = true; CreatedAtUtc = UpdatedAtUtc = now;
    }
    public int Id { get; private set; }
    public string Name { get; private set; } = "";
    public string PinHash { get; private set; } = "";
    public string PinSalt { get; private set; } = "";
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public void Update(string? name, string? hash, string? salt, bool? active, DateTimeOffset now)
    {
        if (name is not null) Rename(name);
        if (hash is not null) { PinHash = hash; PinSalt = salt!; }
        if (active is not null) IsActive = active.Value;
        UpdatedAtUtc = now;
    }
    private void Rename(string value)
    {
        var name = string.Join(' ', (value ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries));
        if (name.Length is < 2 or > 80) throw new DomainException("Professor name must contain 2 to 80 characters.");
        Name = name;
    }
}
