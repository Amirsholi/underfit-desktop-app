namespace UnderFit.Contracts.Classes;

public sealed record CreateClassRequest(
    string Name,
    DateOnly Date,
    TimeOnly Time,
    int DurationMinutes,
    int Capacity,
    string Professor,
    int? ProfessorId,
    int LocationId,
    string? Notes);

public sealed record ClassResponse(
    int Id,
    string Name,
    DateOnly Date,
    TimeOnly Time,
    int DurationMinutes,
    int Capacity,
    string Professor,
    int? ProfessorId,
    int LocationId,
    string LocationName,
    string? Notes,
    string Status,
    int Enrolled,
    int? ScheduleId,
    bool IsTrial);

public sealed record MemberClassResponse(
    int Id,
    string Name,
    DateOnly Date,
    TimeOnly Time,
    int DurationMinutes,
    string Professor,
    int LocationId,
    string LocationName,
    string? Notes);

public sealed record MemberClassAvailabilityResponse(
    int Id,
    string Name,
    DateOnly Date,
    TimeOnly Time,
    int DurationMinutes,
    string Professor,
    int LocationId,
    string LocationName,
    string? Notes,
    int Capacity,
    int Enrolled,
    int AvailableSpots,
    bool IsEnrolled,
    bool CanEnroll,
    bool CanCancel,
    string Status);

public sealed record MemberClassBookingResponse(
    int ClassId,
    bool IsEnrolled,
    int Enrolled,
    int AvailableSpots,
    string Status);

public sealed record CreateClassScheduleRequest(
    string Name,
    int LocationId,
    int ProfessorId,
    string Professor,
    IReadOnlyList<int> Weekdays,
    TimeOnly Time,
    int DurationMinutes,
    int Capacity,
    DateOnly StartsOn,
    DateOnly? EndsOn,
    string? Notes);

public sealed record ClassScheduleResponse(
    int Id,
    string Name,
    int LocationId,
    int ProfessorId,
    string Professor,
    IReadOnlyList<int> Weekdays,
    TimeOnly Time,
    int DurationMinutes,
    int Capacity,
    DateOnly StartsOn,
    DateOnly? EndsOn,
    string? Notes,
    string Status,
    int CreatedOccurrences);

public sealed record EnrollClassRequest(string IdentityNumber);

public sealed record ClassEnrollmentResponse(
    Guid Id,
    int ClassId,
    int? ScheduleId,
    string MemberIdentityNumber,
    string MemberName,
    string Status,
    DateTimeOffset CreatedAtUtc,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveUntil);

public sealed record RemoveClassEnrollmentResponse(
    bool Removed,
    Guid EnrollmentId,
    int ClassId,
    DateOnly EffectiveUntil);

public sealed record CurrentClassResponse(
    int LocationId, DateOnly Date, TimeOnly Time, ClassResponse? Class,
    bool RequiresSelection, IReadOnlyList<ClassResponse> Candidates, ClassResponse? Next);

public sealed record RegisterClassAttendanceRequest(
    string IdentityNumber, int ProfessorSessionId, string DeviceId,
    int LocationId, int? ClassId, DateOnly? Date, TimeOnly? Time);

public sealed record RegisterClassAttendanceResponse(
    bool Registered, string Reason, string MemberIdentityNumber, string MemberName,
    ClassResponse? Class, Guid? AttendanceId, Guid? EntryId,
    CurrentClassResponse? Selection = null);

public sealed record ClassRecordResponse(
    int Id, string Name, DateOnly Date, TimeOnly Time, int DurationMinutes,
    int Capacity, int LocationId, string LocationName, string Professor,
    int? ProfessorId, string Status, DateTimeOffset? ActualStartUtc,
    DateTimeOffset? ActualEndUtc, int? ScheduleId, int Enrolled, int Present,
    bool IsTrial);

public sealed record ClassStudentResponse(
    string IdentityNumber, string MemberName, bool Present,
    TimeOnly? EntryTime, string? DeviceId,
    Guid? AttendanceId = null, int? PerformanceRating = null,
    int? RatedByProfessorId = null, DateTimeOffset? RatedAtUtc = null);

public sealed record ClassRecordDetailResponse(
    ClassRecordResponse Class, IReadOnlyList<ClassStudentResponse> Students,
    int Enrolled, int Present, int Absent);

public sealed record SetClassHeldStatusRequest(bool Held);
public sealed record SetClassHeldStatusResponse(int ClassId, string Status, bool Held);
public sealed record SetClassTrialRequest(bool IsTrial);
public sealed record SetClassTrialResponse(int ClassId, bool IsTrial);

public sealed record SetClassPerformanceRatingRequest(
    int Score,
    int ProfessorId,
    int? ProfessorSessionId = null,
    string? DeviceId = null);

public sealed record SetClassPerformanceRatingResponse(
    Guid AttendanceId,
    int ClassId,
    string MemberIdentityNumber,
    int Score,
    int ProfessorId,
    DateTimeOffset RatedAtUtc);

public sealed record CorrectClassAttendanceRequest(
    string IdentityNumber,
    bool Present,
    int ProfessorId,
    string Reason);

public sealed record CorrectClassAttendanceResponse(
    int ClassId,
    string MemberIdentityNumber,
    bool Present,
    Guid? AttendanceId,
    Guid? EntryId);
