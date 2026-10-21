using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using UnderFit.Application.Classes;
using UnderFit.Application.Common;
using UnderFit.Application.Training;
using UnderFit.Contracts.Training;
using UnderFit.Domain.Attendance;
using UnderFit.Domain.Classes;
using UnderFit.Domain.Inventory;
using UnderFit.Infrastructure.Persistence;

namespace UnderFit.Api.Tablet;

public sealed class TabletService(UnderFitDbContext db, ClassService classes, TrainingService training, TimeProvider clock)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    public async Task<object> StateAsync(DateOnly? from, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(clock.GetLocalNow().DateTime);
        var start = from ?? today.AddDays(-((int)today.DayOfWeek + 6) % 7);
        if (Math.Abs(start.DayNumber - today.DayNumber) > 366)
            throw new UseCaseException("tablet.date_invalid", "Elegí una fecha dentro del año próximo o anterior.");
        await classes.ListAsync(start, ct);
        var end = start.AddDays(7);
        var visible = await db.GymClasses.AsNoTracking()
            .Where(x => x.Status != GymClassStatus.Deleted && x.Date >= start && x.Date < end)
            .OrderBy(x => x.Date).ThenBy(x => x.Time).ToArrayAsync(ct);
        var records = new List<object>();
        foreach (var item in visible)
        {
            var detail = await classes.GetRecordDetailAsync(item.Id, ct);
            records.Add(new { id = item.Id.ToString(), seriesId = item.ScheduleId?.ToString(), name = item.Name,
                date = item.Date, time = item.Time.ToString("HH:mm"), duration = item.DurationMinutes,
                capacity = item.Capacity, professor = item.ProfessorName, professorId = item.ProfessorId,
                location = item.LocationId, trial = item.IsTrial, cancelled = item.Status == GymClassStatus.Cancelled,
                roster = detail.Students.Select(x => new { memberId = x.IdentityNumber, name = x.MemberName,
                    presence = x.Present ? "present" : null, rating = x.PerformanceRating ?? 0 }) });
        }
        var schedules = await db.ClassSchedules.AsNoTracking().Where(x => x.IsActive).ToArrayAsync(ct);
        var templates = await training.ListTemplatesAsync(ct);
        var rawTemplates = await db.WorkoutTemplates.AsNoTracking().Where(x => x.IsActive).ToDictionaryAsync(x => x.Id, ct);
        var assignments = await training.ListActiveMemberPlansAsync(ct);
        return new {
            classes = records,
            schedules = schedules.Select(x => new { id = x.Id.ToString(), name = x.Name, location = x.LocationId,
                professor = x.ProfessorName, professorId = x.ProfessorId, time = x.Time.ToString("HH:mm"),
                duration = x.DurationMinutes, capacity = x.Capacity, startDate = x.StartsOn, endDate = x.EndsOn,
                weekdays = x.Weekdays.Split(',').Select(int.Parse), trial = x.IsTrial, version = x.UpdatedAtUtc }),
            members = await db.Members.AsNoTracking().OrderBy(x => x.Name).Select(x => new { id = x.IdentityNumber, ci = x.IdentityNumber, name = x.Name }).ToArrayAsync(ct),
            professors = await db.Professors.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).Select(x => new { id = x.Id, name = x.Name }).ToArrayAsync(ct),
            products = await db.Products.AsNoTracking().Where(x => x.IsActive && x.AvailableLocal2).Select(x => new { id = x.Id, name = x.Name, price = x.Price }).ToArrayAsync(ct),
            exercises = await training.ListExercisesAsync(false, ct),
            templates = templates.Where(x => x.IsActive).Select(x => new { x.Id, x.Name, x.Days, x.ProfessorId, version = TemplateVersion(rawTemplates[x.Id]) }),
            assignments,
        };
    }

    public async Task<object> AttendanceAsync(int id, TabletAttendanceRequest request, string deviceId, CancellationToken ct)
    {
        var gymClass = await RequireClass(id, ct);
        gymClass.Synchronize(clock.GetLocalNow());
        if (gymClass.Status == GymClassStatus.Cancelled || gymClass.Date > DateOnly.FromDateTime(clock.GetLocalNow().DateTime))
            throw new UseCaseException("class.attendance_unavailable", "No se puede pasar lista en una clase cancelada o de otro día futuro.");
        var enrolled = await classes.ListEnrollmentsAsync(id, ct);
        if (!enrolled.Any(x => x.MemberIdentityNumber == request.IdentityNumber))
            throw new UseCaseException("class.enrollment_required", "El socio no está inscripto en esta clase.");
        var existing = await db.FindClassAttendanceAsync(id, request.IdentityNumber, ct);
        if ((existing is not null) != request.ExpectedPresent)
            throw new UseCaseException("class.attendance_conflict", "La asistencia cambió desde otra pantalla. Actualizá y revisala.");
        if (request.Present == (existing is not null)) return new { present = request.Present };
        if (!request.Present)
        {
            var reason = $"Asistencia desmarcada desde tablet {deviceId}";
            existing!.Annul(reason, clock.GetUtcNow());
            var entry = await db.FindEntryAsync(existing.EntryId, ct);
            if (entry is not null && !entry.IsAnnulled) entry.Annul(reason, clock.GetUtcNow());
        }
        else
        {
            var member = await db.FindMemberByIdentityAsync(request.IdentityNumber, ct)
                ?? throw new UseCaseException("member.not_found", "El socio ya no existe.");
            if (!member.CanEnterOn(gymClass.Date)) throw new UseCaseException("membership.expired", "La membresía no cubre la fecha de esta clase.");
            var professor = await db.FindProfessorAsync(gymClass.ProfessorId ?? 0, ct)
                ?? throw new UseCaseException("staff.not_found", "La clase no tiene un profesor asignado.");
            var occurred = new DateTimeOffset(gymClass.Date.ToDateTime(gymClass.Time), clock.GetLocalNow().Offset).ToUniversalTime();
            var entry = Entry.Register(member.Id, member.IdentityNumber, member.Name, occurred, "tablet_clase", $"Asistencia a {gymClass.Name}", gymClass.LocationId, deviceId, id);
            db.AddEntry(entry);
            db.AddClassAttendance(new ClassAttendance(id, gymClass.ScheduleId, member.Id, member.IdentityNumber, member.Name, entry.Id, gymClass.LocationId, professor.Id, null, deviceId, occurred));
        }
        await db.SaveChangesAsync(ct);
        return new { present = request.Present };
    }

    public async Task<object> RatingAsync(int id, TabletRatingRequest request, CancellationToken ct)
    {
        var gymClass = await RequireClass(id, ct);
        if (!gymClass.IsTrial) throw new UseCaseException("class.rating_unavailable", "Solo se evalúan clases de prueba.");
        var attendance = await db.FindClassAttendanceAsync(id, request.IdentityNumber, ct)
            ?? throw new UseCaseException("attendance.not_found", "Primero registrá la asistencia.");
        return await classes.SetPerformanceRatingAsync(attendance.Id, new(request.Score, gymClass.ProfessorId ?? 0), ct);
    }

    public async Task<object> DeliverAsync(int id, TabletDeliveryRequest request, CancellationToken ct)
    {
        await RequireClass(id, ct);
        if (!await db.ClassAttendanceExistsAsync(id, request.IdentityNumber, ct))
            throw new UseCaseException("delivery.attendance_required", "La entrega requiere que el alumno esté presente.");
        var member = await db.FindMemberByIdentityAsync(request.IdentityNumber, ct)
            ?? throw new UseCaseException("member.not_found", "El socio ya no existe.");
        var product = await db.FindProductAsync(request.ProductId, ct);
        var professor = await UnderFit.Application.Staff.ProfessorAttribution.ResolveAsync(db, request.ProfessorName, request.ProfessorId, clock, ct);
        if (product is null || !product.IsActive || !product.AvailableLocal2 || professor is null || !professor.IsActive)
            throw new UseCaseException("delivery.invalid", "El producto o profesor ya no está disponible.");
        var sale = new PendingProductSale(product, member.IdentityNumber, member.Name, request.Quantity,
            professor.Name, professor.Id, null, 2, $"Entrega de clase {id}", clock.GetUtcNow());
        db.AddPendingProductSale(sale); await db.SaveChangesAsync(ct);
        return new { id = sale.Id, total = sale.Total, status = "pending" };
    }

    public async Task<object> SaveScheduleAsync(int? id, TabletScheduleRequest request, CancellationToken ct)
    {
        var input = request.Schedule;
        if (input.LocationId is not (1 or 2) || input.DurationMinutes is < 15 or > 240 || input.Capacity is < 1 or > 100)
            throw new UseCaseException("schedule.invalid", "Revisá duración, cupo y salón.");
        var professor = await UnderFit.Application.Staff.ProfessorAttribution.ResolveAsync(db, input.Professor, input.ProfessorId, clock, ct);
        if (professor is null || !professor.IsActive) throw new UseCaseException("staff.not_found", "El profesor ya no está disponible.");
        ClassSchedule schedule;
        if (id is null)
        {
            schedule = new(input.Name, input.LocationId, professor.Id, professor.Name, input.Weekdays, input.Time,
                input.DurationMinutes, input.Capacity, input.StartsOn, input.EndsOn, input.Notes, clock.GetUtcNow());
            schedule.MarkAsTrial(request.IsTrial);
            db.AddClassSchedule(schedule);
            await db.SaveChangesAsync(ct);
        }
        else
        {
            schedule = await db.ClassSchedules.SingleOrDefaultAsync(x => x.Id == id && x.IsActive, ct)
                ?? throw new UseCaseException("schedule.not_found", "La clase semanal ya no existe.");
            if (schedule.UpdatedAtUtc != request.ExpectedVersion)
                throw new UseCaseException("schedule.conflict", "La clase cambió desde otra pantalla. Volvé a abrirla.");
            var upcoming = await db.GymClasses.Where(x => x.ScheduleId == id).ToArrayAsync(ct);
            upcoming = upcoming.Where(x => new DateTimeOffset(x.Date.ToDateTime(x.Time), clock.GetLocalNow().Offset) > clock.GetLocalNow()).ToArray();
            foreach (var item in upcoming)
                if ((await classes.ListEnrollmentsAsync(item.Id, ct)).Count > input.Capacity)
                    throw new UseCaseException("schedule.capacity_invalid", "El cupo no puede ser menor que los alumnos inscriptos.");
            schedule.Update(input.Name, professor.Id, professor.Name, input.Weekdays, input.Time, input.DurationMinutes,
                input.Capacity, input.EndsOn, input.Notes, request.IsTrial, clock.GetUtcNow());
            foreach (var item in upcoming) item.UpdateFromSchedule(schedule, clock.GetLocalNow());
            await db.SaveChangesAsync(ct);
        }
        await classes.ListAsync(DateOnly.FromDateTime(clock.GetLocalNow().DateTime), ct);
        return new { id = schedule.Id };
    }

    public async Task<object> CreateTemplateAsync(SaveWorkoutTemplateRequest request, CancellationToken ct)
    {
        await ValidateDays(request.Days, ct);
        if (request.ProfessorId is null && request.ProfessorName is null) throw new UseCaseException("staff.not_found", "Escribí el nombre del profesor.");
        var result = await training.SaveTemplateAsync(request, ct);
        var template = await db.WorkoutTemplates.SingleAsync(x => x.Id == result.Id, ct);
        return new { id = template.Id, version = TemplateVersion(template) };
    }

    public async Task<object> UpdateTemplateAsync(int id, TabletTemplateRequest request, CancellationToken ct)
    {
        var template = await db.WorkoutTemplates.SingleOrDefaultAsync(x => x.Id == id && x.IsActive, ct)
            ?? throw new UseCaseException("template.not_found", "La plantilla ya no existe.");
        if (request.ExpectedVersion != TemplateVersion(template)) throw new UseCaseException("template.conflict", "La plantilla cambió. Volvé a abrirla.");
        await ValidateDays(request.Template.Days, ct);
        var author = await UnderFit.Application.Staff.ProfessorAttribution.ResolveAsync(db, request.Template.ProfessorName, request.Template.ProfessorId, clock, ct);
        template.Update(request.Template.Name, JsonSerializer.Serialize(request.Template.Days, JsonOptions), true);
        template.SetProfessor(author.Id);
        await db.SaveChangesAsync(ct); return new { id = template.Id, version = TemplateVersion(template) };
    }

    public async Task<WorkoutPlanResponse> SavePlanAsync(string identity, TabletPlanRequest request, CancellationToken ct)
    {
        var member = await db.FindMemberByIdentityAsync(identity, ct)
            ?? throw new UseCaseException("member.not_found", "El socio ya no existe.");
        var current = await db.FindActiveWorkoutPlanAsync(member.Id, ct);
        if (current?.Id != request.ExpectedPlanId) throw new UseCaseException("plan.conflict", "La rutina cambió. Volvé a abrirla.");
        await ValidateDays(request.Plan.Days, ct);
        return await training.AssignPlanAsync(identity, request.Plan, ct);
    }

    private async Task ValidateDays(IReadOnlyList<AssignWorkoutDayRequest> days, CancellationToken ct)
    {
        if (days.Count == 0 || days.Any(x => x.Exercises.Count == 0 || x.Exercises.Any(e => e.Sets is < 1 or > 30 || string.IsNullOrWhiteSpace(e.Repetitions))))
            throw new UseCaseException("plan.invalid", "Revisá los días, ejercicios, series y repeticiones.");
        var ids = days.SelectMany(x => x.Exercises).Select(x => x.ExerciseId).Distinct().ToArray();
        if (await db.Exercises.CountAsync(x => ids.Contains(x.Id) && x.IsActive, ct) != ids.Length)
            throw new UseCaseException("exercise.not_found", "Un ejercicio ya no está disponible.");
    }
    private async Task<GymClass> RequireClass(int id, CancellationToken ct) =>
        await db.GymClasses.SingleOrDefaultAsync(x => x.Id == id && x.Status != GymClassStatus.Deleted, ct)
        ?? throw new UseCaseException("class.not_found", "La clase no pertenece al salón o ya no existe.");
    public static string TemplateVersion(UnderFit.Domain.Training.WorkoutTemplate template) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(template.Name + "\n" + template.DaysJson + "\n" + template.ProfessorId)));
}
