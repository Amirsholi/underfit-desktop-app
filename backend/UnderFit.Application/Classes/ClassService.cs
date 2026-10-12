using UnderFit.Application.Abstractions;
using UnderFit.Contracts.Classes;
using UnderFit.Domain.Classes;
using UnderFit.Application.Common;
using UnderFit.Domain.Attendance;

namespace UnderFit.Application.Classes;

public sealed class ClassService(IUnderFitDataStore dataStore, TimeProvider timeProvider)
{
    public async Task<ClassResponse> CreateAsync(
        CreateClassRequest request,
        CancellationToken cancellationToken)
    {
        var item = new GymClass(
            request.Name, request.Date, request.Time, request.DurationMinutes,
            request.Capacity, request.Professor, request.ProfessorId,
            request.LocationId, request.Notes, timeProvider.GetUtcNow());
        dataStore.AddClass(item);
        await dataStore.SaveChangesAsync(cancellationToken);
        return Map(item);
    }

    public async Task<IReadOnlyList<ClassResponse>> ListAsync(
        DateOnly from,
        CancellationToken cancellationToken)
    {
        await EnsureOccurrencesAsync(from, cancellationToken);
        var items = await dataStore.ListClassesAsync(from, cancellationToken);
        var now = timeProvider.GetLocalNow();
        foreach (var item in items) item.Synchronize(now);
        await dataStore.SaveChangesAsync(cancellationToken);
        return items
            .Where(item => item.Status is GymClassStatus.Scheduled or GymClassStatus.InProgress)
            .Select(Map).ToArray();
    }

    public async Task<IReadOnlyList<ClassResponse>> ListAgendaAsync(DateOnly from, CancellationToken ct)
    {
        await EnsureOccurrencesAsync(from, ct);
        var items = await dataStore.ListClassesInRangeAsync(from, from.AddDays(6), ct);
        var result = new List<ClassResponse>();
        foreach (var item in items)
        {
            if (item.Status == GymClassStatus.Deleted) continue;
            item.Synchronize(timeProvider.GetLocalNow());
            var enrolled = await dataStore.ListClassEnrollmentsAsync(item.Id, item.ScheduleId, item.Date, ct);
            result.Add(Map(item) with { Enrolled = enrolled.Count });
        }
        await dataStore.SaveChangesAsync(ct);
        return result.OrderBy(x => x.Date).ThenBy(x => x.Time).ToArray();
    }

    public async Task<IReadOnlyList<MemberClassResponse>> ListMemberCalendarAsync(
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var today = Today();
        await EnsureOccurrencesAsync(today, cancellationToken);
        var items = await dataStore.ListMemberEnrolledClassesAsync(
            memberId, today, cancellationToken);
        return items.Select(item => new MemberClassResponse(
            item.Id,
            item.Name,
            item.Date,
            item.Time,
            item.DurationMinutes,
            item.ProfessorName,
            item.LocationId,
            item.LocationId == 1 ? "Recepción principal" : "Salón funcional",
            item.Notes)).ToArray();
    }

    public async Task<IReadOnlyList<MemberClassAvailabilityResponse>> ListMemberAvailabilityAsync(
        Guid memberId, CancellationToken cancellationToken)
    {
        var member = await dataStore.FindMemberByIdAsync(memberId, cancellationToken)
            ?? throw new UseCaseException("member.not_found", "Member was not found.");
        var today = Today();
        await EnsureOccurrencesAsync(today, cancellationToken);
        var classes = await dataStore.ListClassesAsync(today, cancellationToken);
        var result = new List<MemberClassAvailabilityResponse>(classes.Count);
        foreach (var item in classes.Where(item => item.Date <= today.AddDays(30)))
        {
            item.Synchronize(timeProvider.GetLocalNow());
            var enrolledMembers = await dataStore.ListClassEnrollmentsAsync(
                item.Id, item.ScheduleId, item.Date, cancellationToken);
            var isEnrolled = enrolledMembers.Any(enrollment =>
                enrollment.MemberIdentityNumber == member.IdentityNumber);
            var available = Math.Max(0, item.Capacity - enrolledMembers.Count);
            var membershipCoversClass = member.CanEnterOn(item.Date);
            var scheduled = item.Status == GymClassStatus.Scheduled;
            result.Add(new MemberClassAvailabilityResponse(
                item.Id, item.Name, item.Date, item.Time, item.DurationMinutes,
                item.ProfessorName, item.LocationId,
                item.LocationId == 1 ? "Recepción principal" : "Salón funcional",
                item.Notes, item.Capacity, enrolledMembers.Count, available,
                isEnrolled,
                scheduled && membershipCoversClass && !isEnrolled && available > 0,
                scheduled && isEnrolled,
                !scheduled ? "unavailable" : isEnrolled ? "enrolled" :
                    !membershipCoversClass ? "membership_expired" :
                    available == 0 ? "full" : "available"));
        }
        await dataStore.SaveChangesAsync(cancellationToken);
        return result;
    }

    public async Task<MemberClassBookingResponse> EnrollOccurrenceAsync(
        Guid memberId, int classId, CancellationToken cancellationToken)
    {
        var gymClass = await RequireClassAsync(classId, cancellationToken);
        gymClass.Synchronize(timeProvider.GetLocalNow());
        if (gymClass.Status != GymClassStatus.Scheduled)
            throw new UseCaseException("class.unavailable", "Class is not available.");
        var member = await dataStore.FindMemberByIdAsync(memberId, cancellationToken)
            ?? throw new UseCaseException("member.not_found", "Member was not found.");
        if (!member.CanEnterOn(gymClass.Date))
            throw new UseCaseException("class.membership_expired", "Membership does not cover the class date.");
        var current = await dataStore.ListClassEnrollmentsAsync(
            gymClass.Id, gymClass.ScheduleId, gymClass.Date, cancellationToken);
        if (current.Any(item => item.MemberIdentityNumber == member.IdentityNumber))
            throw new UseCaseException("class.already_enrolled", "Member is already enrolled in this class.");
        if (current.Count >= gymClass.Capacity)
            throw new UseCaseException("class.full", "Class has no available capacity.");
        dataStore.AddClassEnrollment(ClassEnrollment.CreateOccurrence(
            gymClass, member.Id, member.IdentityNumber, member.Name,
            timeProvider.GetUtcNow(), "mobile"));
        await dataStore.SaveChangesAsync(cancellationToken);
        return new MemberClassBookingResponse(
            gymClass.Id, true, current.Count + 1,
            Math.Max(0, gymClass.Capacity - current.Count - 1), "enrolled");
    }

    public async Task<MemberClassBookingResponse> CancelOccurrenceAsync(
        Guid memberId, int classId, CancellationToken cancellationToken)
    {
        var gymClass = await RequireClassAsync(classId, cancellationToken);
        gymClass.Synchronize(timeProvider.GetLocalNow());
        if (gymClass.Status != GymClassStatus.Scheduled)
            throw new UseCaseException("class.unavailable", "Class can no longer be cancelled.");
        var member = await dataStore.FindMemberByIdAsync(memberId, cancellationToken)
            ?? throw new UseCaseException("member.not_found", "Member was not found.");
        var occurrence = await dataStore.FindActiveOccurrenceEnrollmentAsync(
            gymClass.Id, member.IdentityNumber, cancellationToken);
        var recurring = gymClass.ScheduleId is null ? null :
            await dataStore.FindActiveScheduleEnrollmentAsync(
                gymClass.ScheduleId.Value, member.IdentityNumber, gymClass.Date,
                cancellationToken);
        if (occurrence is null && recurring is null)
            throw new UseCaseException("class.enrollment_not_found", "Class enrollment was not found.");
        if (occurrence is not null)
            occurrence.EndBefore(gymClass.Date, timeProvider.GetUtcNow());
        if (recurring is not null &&
            await dataStore.FindClassEnrollmentExceptionAsync(
                gymClass.Id, member.IdentityNumber, cancellationToken) is null)
        {
            dataStore.AddClassEnrollmentException(new ClassEnrollmentException(
                gymClass.Id, member.Id, member.IdentityNumber, member.Name,
                "mobile", timeProvider.GetUtcNow()));
        }
        await dataStore.SaveChangesAsync(cancellationToken);
        var remaining = await dataStore.ListClassEnrollmentsAsync(
            gymClass.Id, gymClass.ScheduleId, gymClass.Date, cancellationToken);
        return new MemberClassBookingResponse(
            gymClass.Id, false, remaining.Count,
            Math.Max(0, gymClass.Capacity - remaining.Count), "cancelled");
    }

    public async Task<ClassScheduleResponse> CreateScheduleAsync(
        CreateClassScheduleRequest request,
        CancellationToken cancellationToken)
    {
        var schedule = new ClassSchedule(
            request.Name, request.LocationId, request.ProfessorId, request.Professor,
            request.Weekdays, request.Time, request.DurationMinutes, request.Capacity,
            request.StartsOn, request.EndsOn, request.Notes, timeProvider.GetUtcNow());
        dataStore.AddClassSchedule(schedule);
        var from = request.StartsOn > Today() ? request.StartsOn : Today();
        var dates = schedule.GenerateDates(from, from.AddDays(70));
        foreach (var date in dates)
        {
            var occurrence = CreateOccurrence(schedule, date);
            dataStore.AddClass(occurrence);
        }
        await dataStore.SaveChangesAsync(cancellationToken);
        return Map(schedule, dates.Count);
    }

    public async Task<IReadOnlyList<ClassEnrollmentResponse>> ListEnrollmentsAsync(
        int classId,
        CancellationToken cancellationToken)
    {
        var gymClass = await RequireClassAsync(classId, cancellationToken);
        var enrollments = await dataStore.ListClassEnrollmentsAsync(
            gymClass.Id, gymClass.ScheduleId, gymClass.Date, cancellationToken);
        return enrollments.Select(item => Map(item, gymClass.Id)).ToArray();
    }

    public async Task<ClassEnrollmentResponse> EnrollAsync(
        int classId,
        EnrollClassRequest request,
        CancellationToken cancellationToken)
    {
        var gymClass = await RequireClassAsync(classId, cancellationToken);
        gymClass.Synchronize(timeProvider.GetLocalNow());
        if (gymClass.Status != GymClassStatus.Scheduled)
            throw new UseCaseException("class.unavailable", "Class is not available.");
        var member = await dataStore.FindMemberByIdentityAsync(
            request.IdentityNumber.Trim(), cancellationToken)
            ?? throw new UseCaseException("member.not_found", "Member was not found.");
        var activeEnrollment = await dataStore.FindActiveClassEnrollmentAsync(
            gymClass.Id, gymClass.ScheduleId, member.IdentityNumber, cancellationToken);
        if (activeEnrollment is not null)
            throw new UseCaseException("class.already_enrolled", "Member is already enrolled in this class.");
        var existing = await dataStore.ListClassEnrollmentsAsync(
            gymClass.Id, gymClass.ScheduleId, gymClass.Date, cancellationToken);
        if (existing.Count >= gymClass.Capacity)
            throw new UseCaseException("class.full", "Class has no available capacity.");
        var enrollment = ClassEnrollment.Create(
            gymClass, member.Id, member.IdentityNumber, member.Name, timeProvider.GetUtcNow());
        dataStore.AddClassEnrollment(enrollment);
        await dataStore.SaveChangesAsync(cancellationToken);
        return Map(enrollment, gymClass.Id);
    }

    public async Task<RemoveClassEnrollmentResponse> RemoveEnrollmentAsync(
        int classId,
        string identityNumber,
        CancellationToken cancellationToken)
    {
        var gymClass = await RequireClassAsync(classId, cancellationToken);
        gymClass.Synchronize(timeProvider.GetLocalNow());
        if (gymClass.Status != GymClassStatus.Scheduled)
            throw new UseCaseException("class.removal_unavailable", "Solo se pueden quitar inscripciones de clases que todavía no comenzaron.");
        var enrollment = await dataStore.FindActiveClassEnrollmentAsync(
            gymClass.Id, gymClass.ScheduleId, identityNumber.Trim(), cancellationToken)
            ?? throw new UseCaseException("class.enrollment_not_found", "Class enrollment was not found.");
        enrollment.EndBefore(gymClass.Date, timeProvider.GetUtcNow());
        await dataStore.SaveChangesAsync(cancellationToken);
        return new(true, enrollment.Id, gymClass.Id, gymClass.Date.AddDays(-1));
    }

    public async Task<object> DeleteAsync(int classId, CancellationToken ct)
    {
        var item = await RequireClassAsync(classId, ct);
        if ((await dataStore.ListClassAttendancesAsync(classId, ct)).Count > 0)
            throw new UseCaseException("class.has_attendance", "Esta clase tiene asistencias. Conservá el historial y corregí las asistencias si corresponde.");
        item.Delete();
        await dataStore.SaveChangesAsync(ct);
        return new { deleted = true, classId };
    }

    public async Task<CurrentClassResponse> GetCurrentAsync(
        int locationId, DateOnly? date, TimeOnly? at, CancellationToken ct)
    {
        var localNow=timeProvider.GetLocalNow();
        var day=date??DateOnly.FromDateTime(localNow.DateTime);
        var clock=at??TimeOnly.FromDateTime(localNow.DateTime);
        await EnsureOccurrencesAsync(day,ct);
        var candidates=await dataStore.ListClassCandidatesAsync(locationId,day,ct);
        foreach(var item in candidates)item.Synchronize(localNow);
        await dataStore.SaveChangesAsync(ct);
        var minute=clock.Hour*60+clock.Minute;
        var matching=candidates.Where(x=>x.Status is GymClassStatus.Scheduled or GymClassStatus.InProgress)
            .Where(x=>{var start=x.Time.Hour*60+x.Time.Minute;return minute>=start-45&&minute<=start+x.DurationMinutes+30;})
            .OrderByDescending(x=>x.Status==GymClassStatus.InProgress).ThenBy(x=>Math.Abs((x.Time.Hour*60+x.Time.Minute)-minute)).ToArray();
        var upcoming=(await dataStore.ListClassesAsync(day,ct)).Where(x=>x.LocationId==locationId&&(x.Date>day||x.Time>clock)).OrderBy(x=>x.Date).ThenBy(x=>x.Time).FirstOrDefault();
        return new(locationId,day,clock,matching.Length==1?Map(matching[0]):null,matching.Length>1,matching.Select(Map).ToArray(),upcoming is null?null:Map(upcoming));
    }

    public async Task<RegisterClassAttendanceResponse> RegisterAttendanceAsync(
        RegisterClassAttendanceRequest request,CancellationToken ct)
    {
        var session=await dataStore.FindActiveProfessorSessionAsync(request.ProfessorSessionId,ct)
            ??throw new UseCaseException("staff.session_inactive","Professor session is not active.");
        if(session.DeviceId!=request.DeviceId||session.LocationId!=request.LocationId)
            throw new UseCaseException("staff.session_mismatch","Professor session belongs to another device or location.");
        var current=await GetCurrentAsync(request.LocationId,request.Date,request.Time,ct);
        if(request.ClassId is null&&current.RequiresSelection)return new(false,"class_selection_required",request.IdentityNumber,"",null,null,null,current);
        var classId=request.ClassId??current.Class?.Id??throw new UseCaseException("class.not_active","No active class is available.");
        var gymClass=await RequireClassAsync(classId,ct);
        if(!current.Candidates.Any(x=>x.Id==classId)&&current.Class?.Id!=classId)
            throw new UseCaseException("class.not_active","No active class is available.");
        var member=await dataStore.FindMemberByIdentityAsync(request.IdentityNumber.Trim(),ct)
            ??throw new UseCaseException("member.not_found","Member was not found.");
        var day=current.Date;
        if(!member.CanEnterOn(day))throw new UseCaseException("access.membership_expired","Membership is expired.");
        if(await dataStore.ClassAttendanceExistsAsync(classId,member.IdentityNumber,ct))
            throw new UseCaseException("class.attendance_duplicate","Member attendance is already registered.");
        var now=timeProvider.GetUtcNow();
        var entry=Entry.Register(member.Id,member.IdentityNumber,member.Name,now,"tablet_clase",$"Asistencia a {gymClass.Name}",request.LocationId,request.DeviceId,classId);
        var attendance=new ClassAttendance(classId,gymClass.ScheduleId,member.Id,member.IdentityNumber,member.Name,entry.Id,request.LocationId,session.ProfessorId,session.Id,session.DeviceId,now);
        dataStore.AddEntry(entry);dataStore.AddClassAttendance(attendance);await dataStore.SaveChangesAsync(ct);
        return new(true,"attendance_registered",member.IdentityNumber,member.Name,Map(gymClass),attendance.Id,entry.Id);
    }

    public async Task<IReadOnlyList<ClassRecordResponse>> ListRecordsAsync(
        DateOnly date,CancellationToken ct)
    {
        var items=await dataStore.ListClassesByDateAsync(date,ct);
        var result=new List<ClassRecordResponse>(items.Count);
        foreach(var item in items.Where(x => x.Status != GymClassStatus.Deleted))
        {
            item.Synchronize(timeProvider.GetLocalNow());
            var enrolled=await dataStore.ListClassEnrollmentsAsync(item.Id,item.ScheduleId,item.Date,ct);
            var present=await dataStore.ListClassAttendancesAsync(item.Id,ct);
            result.Add(MapRecord(item,enrolled.Count,present.Count));
        }
        await dataStore.SaveChangesAsync(ct);
        return result;
    }

    public async Task<ClassRecordDetailResponse> GetRecordDetailAsync(int classId,CancellationToken ct)
    {
        var item=await RequireClassAsync(classId,ct);
        item.Synchronize(timeProvider.GetLocalNow());
        var enrolled=await dataStore.ListClassEnrollmentsAsync(item.Id,item.ScheduleId,item.Date,ct);
        var attendances=await dataStore.ListClassAttendancesAsync(item.Id,ct);
        var byIdentity=attendances.ToDictionary(x=>x.MemberIdentityNumber);
        var students=new List<ClassStudentResponse>();
        foreach(var enrollment in enrolled)
        {
            byIdentity.Remove(enrollment.MemberIdentityNumber,out var attendance);
            students.Add(MapStudent(enrollment.MemberIdentityNumber,enrollment.MemberName,attendance));
        }
        students.AddRange(byIdentity.Values.Select(x=>MapStudent(x.MemberIdentityNumber,x.MemberName,x)));
        await dataStore.SaveChangesAsync(ct);
        var present=attendances.Count;
        return new(MapRecord(item,enrolled.Count,present),students,enrolled.Count,present,Math.Max(0,enrolled.Count-present));
    }

    public async Task<SetClassHeldStatusResponse> SetHeldStatusAsync(
        int classId,SetClassHeldStatusRequest request,CancellationToken ct)
    {
        var item=await RequireClassAsync(classId,ct);
        item.Synchronize(timeProvider.GetLocalNow());
        item.CorrectHeldStatus(request.Held);
        await dataStore.SaveChangesAsync(ct);
        return new(item.Id,request.Held?"dictada":"cancelada",request.Held);
    }

    public async Task<SetClassTrialResponse> SetTrialAsync(
        int classId,
        SetClassTrialRequest request,
        CancellationToken cancellationToken)
    {
        var item = await dataStore.FindClassAsync(classId, cancellationToken)
            ?? throw new KeyNotFoundException("Class not found.");
        item.MarkAsTrial(request.IsTrial);
        await dataStore.SaveChangesAsync(cancellationToken);
        return new SetClassTrialResponse(item.Id, item.IsTrial);
    }

    public async Task<SetClassPerformanceRatingResponse> SetPerformanceRatingAsync(
        Guid attendanceId, SetClassPerformanceRatingRequest request,
        CancellationToken cancellationToken)
    {
        var attendance = await dataStore.FindClassAttendanceAsync(attendanceId, cancellationToken)
            ?? throw new UseCaseException("class.attendance_not_found", "Class attendance was not found.");
        var gymClass = await RequireClassAsync(attendance.ClassId, cancellationToken);
        gymClass.Synchronize(timeProvider.GetLocalNow());
        if (gymClass.Status != GymClassStatus.Held)
            throw new UseCaseException("class.rating_unavailable", "Performance can only be rated after the class finishes.");
        var professor = await dataStore.FindProfessorAsync(request.ProfessorId, cancellationToken)
            ?? throw new UseCaseException("staff.not_found", "Professor was not found.");
        if (!professor.IsActive)
            throw new UseCaseException("staff.inactive", "Professor is inactive.");
        if (request.ProfessorSessionId is not null)
        {
            var session = await dataStore.FindActiveProfessorSessionAsync(
                request.ProfessorSessionId.Value, cancellationToken)
                ?? throw new UseCaseException("staff.session_inactive", "Professor session is not active.");
            if (session.ProfessorId != professor.Id ||
                (!string.IsNullOrWhiteSpace(request.DeviceId) && session.DeviceId != request.DeviceId))
                throw new UseCaseException("staff.session_mismatch", "Professor session does not match.");
        }
        var ratedAt = timeProvider.GetUtcNow();
        attendance.SetPerformanceRating(request.Score, professor.Id, ratedAt);
        await dataStore.SaveChangesAsync(cancellationToken);
        return new SetClassPerformanceRatingResponse(
            attendance.Id, attendance.ClassId, attendance.MemberIdentityNumber,
            request.Score, professor.Id, ratedAt);
    }

    public async Task<CorrectClassAttendanceResponse> CorrectAttendanceAsync(
        int classId, CorrectClassAttendanceRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new UseCaseException("class.correction_reason_required", "A correction reason is required.");
        var gymClass = await RequireClassAsync(classId, cancellationToken);
        gymClass.Synchronize(timeProvider.GetLocalNow());
        if (gymClass.Status != GymClassStatus.Held)
            throw new UseCaseException("class.correction_unavailable", "Attendance can only be corrected after the class finishes.");
        var identity = request.IdentityNumber.Trim();
        var attendance = await dataStore.FindClassAttendanceAsync(
            gymClass.Id, identity, cancellationToken);
        if (!request.Present)
        {
            if (attendance is null)
                throw new UseCaseException("class.attendance_not_found", "Class attendance was not found.");
            var entry = await dataStore.FindEntryAsync(attendance.EntryId, cancellationToken)
                ?? throw new UseCaseException("entry.not_found", "Entry was not found.");
            var now = timeProvider.GetUtcNow();
            attendance.Annul(request.Reason, now);
            if (!entry.IsAnnulled) entry.Annul(request.Reason, now);
            await dataStore.SaveChangesAsync(cancellationToken);
            return new CorrectClassAttendanceResponse(
                gymClass.Id, identity, false, attendance.Id, entry.Id);
        }
        if (attendance is not null)
            throw new UseCaseException("class.attendance_duplicate", "Member attendance is already registered.");
        var member = await dataStore.FindMemberByIdentityAsync(identity, cancellationToken)
            ?? throw new UseCaseException("member.not_found", "Member was not found.");
        var professor = await dataStore.FindProfessorAsync(request.ProfessorId, cancellationToken)
            ?? throw new UseCaseException("staff.not_found", "Professor was not found.");
        var occurredAt = new DateTimeOffset(
            gymClass.Date.ToDateTime(gymClass.Time), timeProvider.GetLocalNow().Offset)
            .ToUniversalTime();
        var correctedEntry = Entry.Register(
            member.Id, member.IdentityNumber, member.Name, occurredAt,
            "administration_correction", request.Reason, gymClass.LocationId,
            "administration", gymClass.Id);
        var correctedAttendance = new ClassAttendance(
            gymClass.Id, gymClass.ScheduleId, member.Id, member.IdentityNumber,
            member.Name, correctedEntry.Id, gymClass.LocationId, professor.Id,
            null, "administration", occurredAt);
        dataStore.AddEntry(correctedEntry);
        dataStore.AddClassAttendance(correctedAttendance);
        await dataStore.SaveChangesAsync(cancellationToken);
        return new CorrectClassAttendanceResponse(
            gymClass.Id, identity, true, correctedAttendance.Id, correctedEntry.Id);
    }

    private async Task<GymClass> RequireClassAsync(
        int classId,
        CancellationToken cancellationToken)
    {
        var item = await dataStore.FindClassAsync(classId, cancellationToken);
        if (item is null || item.Status == GymClassStatus.Deleted)
            throw new UseCaseException("class.not_found", "Class was not found.");
        return item;
    }

    private async Task EnsureOccurrencesAsync(DateOnly from, CancellationToken cancellationToken)
    {
        var schedules = await dataStore.ListActiveClassSchedulesAsync(cancellationToken);
        var existing = (await dataStore.ListClassesInRangeAsync(from, from.AddDays(70), cancellationToken))
            .Where(item => item.ScheduleId.HasValue)
            .Select(item => (item.ScheduleId!.Value, item.Date, item.Time)).ToHashSet();
        var added = false;
        foreach (var schedule in schedules)
        {
            foreach (var date in schedule.GenerateDates(from, from.AddDays(70)))
            {
                var occurrenceStart = new DateTimeOffset(date.ToDateTime(schedule.Time), timeProvider.GetLocalNow().Offset);
                if (schedule.UpdatedAtUtc > schedule.CreatedAtUtc && occurrenceStart <= schedule.UpdatedAtUtc) continue;
                if (!existing.Add((schedule.Id, date, schedule.Time))) continue;
                dataStore.AddClass(CreateOccurrence(schedule, date));
                added = true;
            }
        }
        if (added) await dataStore.SaveChangesAsync(cancellationToken);
    }

    private GymClass CreateOccurrence(ClassSchedule schedule, DateOnly date)
    {
        var occurrence = new GymClass(
            schedule.Name, date, schedule.Time, schedule.DurationMinutes,
            schedule.Capacity, schedule.ProfessorName, schedule.ProfessorId,
            schedule.LocationId, schedule.Notes, timeProvider.GetUtcNow());
        occurrence.AssignSchedule(schedule);
        occurrence.MarkAsTrial(schedule.IsTrial);
        return occurrence;
    }

    private DateOnly Today() => DateOnly.FromDateTime(timeProvider.GetLocalNow().DateTime);

    private static ClassScheduleResponse Map(ClassSchedule schedule, int created) =>
        new(
            schedule.Id, schedule.Name, schedule.LocationId, schedule.ProfessorId,
            schedule.ProfessorName,
            schedule.Weekdays.Split(',').Select(int.Parse).ToArray(),
            schedule.Time, schedule.DurationMinutes, schedule.Capacity,
            schedule.StartsOn, schedule.EndsOn, schedule.Notes,
            schedule.IsActive ? "activa" : "inactiva", created);

    private static ClassEnrollmentResponse Map(ClassEnrollment item, int classId) =>
        new(
            item.Id, classId, item.ScheduleId, item.MemberIdentityNumber,
            item.MemberName, item.IsActive ? "inscripto" : "cancelado",
            item.CreatedAtUtc, item.EffectiveFrom, item.EffectiveUntil);

    private static ClassRecordResponse MapRecord(GymClass item,int enrolled,int present)=>
        new(item.Id,item.Name,item.Date,item.Time,item.DurationMinutes,item.Capacity,
            item.LocationId,item.LocationId==1?"Recepcion principal":"Salon funcional",
            item.ProfessorName,item.ProfessorId,item.Status switch{
                GymClassStatus.Scheduled=>"programada",GymClassStatus.InProgress=>"en_curso",
                GymClassStatus.Held=>"dictada",_=>"cancelada"},
            item.ActualStartUtc,item.ActualEndUtc,item.ScheduleId,enrolled,present,item.IsTrial);

    private ClassStudentResponse MapStudent(string identity,string name,ClassAttendance? attendance)
    {
        TimeOnly? entryTime=attendance is null?null:TimeOnly.FromDateTime(
            TimeZoneInfo.ConvertTime(attendance.OccurredAtUtc,timeProvider.LocalTimeZone).DateTime);
        return new(identity,name,attendance is not null,entryTime,attendance?.DeviceId,
            attendance?.Id,attendance?.PerformanceRating,
            attendance?.RatedByProfessorId,attendance?.RatedAtUtc);
    }

    private static ClassResponse Map(GymClass item) =>
        new(
            item.Id, item.Name, item.Date, item.Time, item.DurationMinutes,
            item.Capacity, item.ProfessorName, item.ProfessorId, item.LocationId,
            item.LocationId == 1 ? "Recepcion principal" : "Salon funcional",
            item.Notes,
            item.Status switch
            {
                GymClassStatus.Scheduled => "programada",
                GymClassStatus.InProgress => "en_curso",
                GymClassStatus.Held => "dictada",
                _ => "cancelada"
            },
            0,
            item.ScheduleId,
            item.IsTrial);
}
