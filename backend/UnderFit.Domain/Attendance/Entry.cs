namespace UnderFit.Domain.Attendance;

public sealed class Entry
{
    private Entry()
    {
    }

    private Entry(
        Guid memberId,
        string memberIdentityNumber,
        string memberName,
        DateTimeOffset occurredAtUtc,
        string source,
        string? observation,
        int locationId,
        string? deviceId,
        int? classId)
    {
        Id = Guid.NewGuid();
        MemberId = memberId;
        OccurredAtUtc = occurredAtUtc;
        Source = source;
        DeviceId = deviceId;
        MemberIdentityNumber = memberIdentityNumber;
        MemberName = memberName;
        Observation = string.IsNullOrWhiteSpace(observation) ? null : observation.Trim();
        LocationId = locationId;
        ClassId = classId;
    }

    public Guid Id { get; private set; }
    public Guid? MemberId { get; private set; }
    public DateTimeOffset OccurredAtUtc { get; private set; }
    public string Source { get; private set; } = string.Empty;
    public string? DeviceId { get; private set; }
    public string MemberIdentityNumber { get; private set; } = string.Empty;
    public string MemberName { get; private set; } = string.Empty;
    public string? Observation { get; private set; }
    public int LocationId { get; private set; }
    public int? ClassId { get; private set; }
    public bool IsAnnulled { get; private set; }
    public DateTimeOffset? AnnulledAtUtc { get; private set; }
    public string? AnnulmentReason { get; private set; }

    public static Entry Register(
        Guid memberId,
        string memberIdentityNumber,
        string memberName,
        DateTimeOffset occurredAtUtc,
        string source,
        string? observation = null,
        int locationId = 1,
        string? deviceId = null,
        int? classId = null) =>
        new(
            memberId,
            memberIdentityNumber,
            memberName,
            occurredAtUtc,
            string.IsNullOrWhiteSpace(source) ? "reception" : source.Trim(),
            observation,
            locationId,
            string.IsNullOrWhiteSpace(deviceId) ? null : deviceId.Trim(),
            classId);

    public void Annul(string reason, DateTimeOffset annulledAtUtc)
    {
        if (IsAnnulled)
        {
            throw new InvalidOperationException("Entry is already annulled.");
        }
        IsAnnulled = true;
        AnnulledAtUtc = annulledAtUtc;
        AnnulmentReason = reason.Trim();
    }
}
