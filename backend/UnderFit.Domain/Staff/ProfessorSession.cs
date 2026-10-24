namespace UnderFit.Domain.Staff;

public sealed class ProfessorSession
{
    private ProfessorSession() { }
    public ProfessorSession(int professorId, string professorName, int locationId, string deviceId, DateTimeOffset now)
    {
        ProfessorId = professorId; ProfessorName = professorName; LocationId = locationId;
        DeviceId = deviceId; StartedAtUtc = now; IsActive = true;
    }
    public int Id { get; private set; }
    public int ProfessorId { get; private set; }
    public string ProfessorName { get; private set; } = "";
    public int LocationId { get; private set; }
    public string DeviceId { get; private set; } = "";
    public DateTimeOffset StartedAtUtc { get; private set; }
    public DateTimeOffset? FinishedAtUtc { get; private set; }
    public bool IsActive { get; private set; }
    public void Finish(DateTimeOffset now) { IsActive = false; FinishedAtUtc = now; }
}
