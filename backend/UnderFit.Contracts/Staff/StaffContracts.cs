namespace UnderFit.Contracts.Staff;
public sealed record CreateProfessorRequest(string Name, string? Pin = null);
public sealed record UpdateProfessorRequest(string? Name, string? Pin, bool? Active);
public sealed record ProfessorResponse(int Id,string Name,bool Active,bool PinConfigured,DateTimeOffset CreatedAtUtc,DateTimeOffset UpdatedAtUtc);
public sealed record StartProfessorSessionRequest(int ProfessorId,string Pin,int LocationId,string DeviceId);
public sealed record ProfessorSessionResponse(int Id,int ProfessorId,string ProfessorName,int LocationId,string DeviceId,DateTimeOffset StartedAtUtc,string Status);
public sealed record FinishProfessorSessionResponse(bool Changed,int Id);
