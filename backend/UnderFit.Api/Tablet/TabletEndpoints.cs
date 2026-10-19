using Microsoft.EntityFrameworkCore;
using UnderFit.Api.Media;
using UnderFit.Application.Classes;
using UnderFit.Application.Common;
using UnderFit.Application.Training;
using UnderFit.Contracts.Classes;
using UnderFit.Contracts.Training;
using UnderFit.Infrastructure.Persistence;

namespace UnderFit.Api.Tablet;

public static class TabletEndpoints
{
    public static void MapTabletEndpoints(this WebApplication app)
    {
        app.MapPost("/api/v1/admin/tablets/{deviceId}/pairing-code", (string deviceId, HttpContext context, TabletPairingService pairing) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var result = pairing.Create(deviceId);
            return result is null ? Results.NotFound(new { title = "La tablet no está configurada en este servidor." }) : Results.Ok(result);
        });
        app.MapPost("/api/v1/tablet-pairing/exchange", (ExchangeTabletCode request, TabletPairingService pairing) =>
        {
            var result = pairing.Exchange(request.DeviceId ?? "", request.Code ?? "");
            return result is null ? Results.Json(new { title = "Código incorrecto, vencido o ya utilizado. Generá uno nuevo desde la PC." }, statusCode: 401) : Results.Ok(result);
        }).RequireRateLimiting("tablet-pairing");
        var group = app.MapGroup("/api/v1/tablet").WithTags("Tablet");
        group.AddEndpointFilter(async (context, next) =>
        {
            if (context.HttpContext.Request.Path.StartsWithSegments("/api/v1/tablet/classes") &&
                int.TryParse(context.HttpContext.Request.RouteValues["id"]?.ToString(), out var id))
            {
                var db = context.HttpContext.RequestServices.GetRequiredService<UnderFitDbContext>();
                if (!await db.GymClasses.AnyAsync(x => x.Id == id && x.LocationId == 2, context.HttpContext.RequestAborted))
                    return Results.NotFound(new { title = "La clase no pertenece al salón o ya no existe." });
            }
            return await next(context);
        });
        group.MapGet("/session", (HttpContext context) => new { deviceId = context.Items["TabletDeviceId"] });
        group.MapGet("/state", (DateOnly? from, TabletService service, CancellationToken ct) => service.StateAsync(from, ct));
        group.MapPost("/classes/{id:int}/attendance", (int id, TabletAttendanceRequest request, HttpContext context, TabletService service, CancellationToken ct) =>
            service.AttendanceAsync(id, request, (string)context.Items["TabletDeviceId"]!, ct));
        group.MapPut("/classes/{id:int}/rating", (int id, TabletRatingRequest request, TabletService service, CancellationToken ct) => service.RatingAsync(id, request, ct));
        group.MapPost("/classes/{id:int}/enrollments", (int id, EnrollClassRequest request, ClassService service, CancellationToken ct) => service.EnrollAsync(id, request, ct));
        group.MapDelete("/classes/{id:int}/enrollments/{identity}", (int id, string identity, ClassService service, CancellationToken ct) => service.RemoveEnrollmentAsync(id, identity, ct));
        group.MapPost("/schedules", (TabletScheduleRequest request, TabletService service, CancellationToken ct) => service.SaveScheduleAsync(null, request, ct));
        group.MapPut("/schedules/{id:int}", (int id, TabletScheduleRequest request, TabletService service, CancellationToken ct) => service.SaveScheduleAsync(id, request, ct));
        group.MapPost("/classes/{id:int}/deliveries", (int id, TabletDeliveryRequest request, TabletService service, CancellationToken ct) => service.DeliverAsync(id, request, ct));
        group.MapPost("/exercises", (CreateExerciseRequest request, TrainingService service, CancellationToken ct) => service.CreateExerciseAsync(request, ct));
        group.MapPut("/exercises/{id:int}", (int id, UpdateExerciseRequest request, TrainingService service, CancellationToken ct) => service.UpdateExerciseAsync(id, request, ct));
        group.MapPost("/templates", (SaveWorkoutTemplateRequest request, TabletService service, CancellationToken ct) => service.CreateTemplateAsync(request, ct));
        group.MapPut("/templates/{id:int}", (int id, TabletTemplateRequest request, TabletService service, CancellationToken ct) => service.UpdateTemplateAsync(id, request, ct));
        group.MapDelete("/templates/{id:int}", async (int id, string expectedVersion, UnderFitDbContext db, CancellationToken ct) =>
        {
            var item = await db.WorkoutTemplates.SingleOrDefaultAsync(x => x.Id == id, ct)
                ?? throw new UseCaseException("template.not_found", "La plantilla ya no existe.");
            if (expectedVersion != TabletService.TemplateVersion(item))
                throw new UseCaseException("template.conflict", "La plantilla cambió. Volvé a abrirla.");
            item.Update(item.Name, item.DaysJson, false);
            await db.SaveChangesAsync(ct); return Results.NoContent();
        });
        group.MapPut("/members/{identity}/plan", (string identity, TabletPlanRequest request, TabletService service, CancellationToken ct) => service.SavePlanAsync(identity, request, ct));
        group.MapDelete("/members/{identity}/plan/{id:guid}", async (string identity, Guid id, UnderFitDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var item = await db.WorkoutPlans.Include(x => x.Member).SingleOrDefaultAsync(x => x.Id == id && x.Member.IdentityNumber == identity && x.IsActive, ct)
                ?? throw new UseCaseException("plan.conflict", "La rutina cambió. Actualizá la pantalla.");
            item.Finish(clock.GetUtcNow()); await db.SaveChangesAsync(ct); return Results.NoContent();
        });
        group.MapPost("/media", async (HttpRequest request, ExerciseVideoProcessor processor, CancellationToken ct) =>
        {
            if (!request.HasFormContentType) return Results.BadRequest(new { title = "Elegí un video." });
            var form = await request.ReadFormAsync(ct);
            var file = form.Files.GetFile("file");
            if (file is null) return Results.BadRequest(new { title = "Falta el archivo." });
            try { return Results.Ok(new { mediaUrl = $"/media/exercises/{await processor.ProcessAsync(file, ct)}" }); }
            catch (InvalidOperationException error) { return Results.BadRequest(new { title = error.Message }); }
        }).DisableAntiforgery();
    }
}

public sealed record TabletAttendanceRequest(string IdentityNumber, bool Present, bool ExpectedPresent);
public sealed record TabletRatingRequest(string IdentityNumber, int Score);
public sealed record TabletScheduleRequest(CreateClassScheduleRequest Schedule, bool IsTrial, DateTimeOffset? ExpectedVersion);
public sealed record TabletDeliveryRequest(string IdentityNumber, int ProductId, int Quantity, int ProfessorId, string? ProfessorName = null);
public sealed record TabletTemplateRequest(SaveWorkoutTemplateRequest Template, string ExpectedVersion);
public sealed record TabletPlanRequest(AssignWorkoutPlanRequest Plan, Guid? ExpectedPlanId);
