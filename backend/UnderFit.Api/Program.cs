using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using UnderFit.Api.Security;
using UnderFit.Api.Media;
using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using UnderFit.Application.Attendance;
using UnderFit.Application.Abstractions;
using UnderFit.Application.Cash;
using UnderFit.Application.Classes;
using UnderFit.Application.Staff;
using UnderFit.Application.Common;
using UnderFit.Application.Members;
using UnderFit.Application.Inventory;
using UnderFit.Application.Settings;
using UnderFit.Application.Mobile;
using UnderFit.Application.Training;
using UnderFit.Contracts.Attendance;
using UnderFit.Contracts.Cash;
using UnderFit.Contracts.Classes;
using UnderFit.Contracts.Staff;
using UnderFit.Contracts.Members;
using UnderFit.Contracts.Inventory;
using UnderFit.Contracts.Settings;
using UnderFit.Contracts.Mobile;
using UnderFit.Contracts.Training;
using UnderFit.Domain.Common;
using UnderFit.Infrastructure;
using UnderFit.Infrastructure.Persistence;
using UnderFit.Api.Tablet;

var builder = WebApplication.CreateBuilder(args);
var tabletConfiguration = builder.Configuration["TabletDevicesFile"];
if (!string.IsNullOrWhiteSpace(tabletConfiguration))
    builder.Configuration.AddJsonFile(tabletConfiguration, optional: false, reloadOnChange: false);
builder.WebHost.ConfigureKestrel(options =>
    options.Limits.MaxRequestBodySize = ExerciseVideoProcessor.MaximumBytes);

builder.Services.AddOpenApi();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<MemberService>();
builder.Services.AddScoped<MembershipPriceService>();
builder.Services.AddScoped<AttendanceService>();
builder.Services.AddScoped<CashSessionService>();
builder.Services.AddScoped<ClassService>();
builder.Services.AddScoped<StaffService>();
builder.Services.AddScoped<InventoryService>();
builder.Services.AddScoped<BusinessSettingsService>();
builder.Services.AddScoped<MemberMobileAuthService>();
builder.Services.AddScoped<MemberMobileHistoryService>();
builder.Services.AddScoped<MemberAccountDeletionService>();
builder.Services.AddScoped<TrainingService>();
builder.Services.AddScoped<TabletService>();
builder.Services.AddSingleton<TabletPairingService>();
builder.Services.AddSingleton<IMemberTokenIssuer, MemberJwtTokenIssuer>();
builder.Services.AddSingleton<ExerciseVideoProcessor>();
builder.Services.AddHostedService<ExerciseMediaCleanupService>();
builder.Services.AddUnderFitInfrastructure(builder.Configuration);
var jwtKey = builder.Configuration["Authentication:JwtKey"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException("Authentication:JwtKey with at least 32 bytes is required.");
}
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = "underfit-api",
            ValidateAudience = true,
            ValidAudience = "underfit-mobile",
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var subject = context.Principal?.FindFirstValue("sub");
                var version = context.Principal?.FindFirstValue("session_version");
                if (!Guid.TryParse(subject, out var memberId) ||
                    !int.TryParse(version, out var sessionVersion))
                {
                    context.Fail("Invalid member session.");
                    return;
                }
                var database = context.HttpContext.RequestServices
                    .GetRequiredService<UnderFitDbContext>();
                var account = await database.MemberMobileAccounts
                    .AsNoTracking()
                    .SingleOrDefaultAsync(
                        item => item.MemberId == memberId,
                        context.HttpContext.RequestAborted);
                if (account is null || !account.IsActive || account.SessionVersion != sessionVersion)
                {
                    context.Fail("Member session has been revoked.");
                }
            }
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("tablet-pairing", limiter =>
    {
        limiter.PermitLimit = 10;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
    options.AddFixedWindowLimiter("mobile-first-use", limiter =>
    {
        limiter.PermitLimit = 10;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
});

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var database = scope.ServiceProvider.GetRequiredService<UnderFitDbContext>();
    await database.Database.MigrateAsync();
}

app.UseExceptionHandler(exceptionHandler =>
{
    exceptionHandler.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        var (status, code, title) = exception switch
        {
            UseCaseException applicationException when applicationException.Code.EndsWith(
                "not_found",
                StringComparison.Ordinal) =>
                (StatusCodes.Status404NotFound, applicationException.Code, applicationException.Message),
            UseCaseException applicationException when applicationException.Code.EndsWith(
                "conflict",
                StringComparison.Ordinal) =>
                (StatusCodes.Status409Conflict, applicationException.Code, applicationException.Message),
            UseCaseException applicationException =>
                (StatusCodes.Status422UnprocessableEntity, applicationException.Code, applicationException.Message),
            DomainException domainException =>
                (StatusCodes.Status400BadRequest, "domain.validation", domainException.Message),
            _ => (StatusCodes.Status500InternalServerError, "server.error", "An unexpected error occurred.")
        };

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = status,
                Title = title,
                Extensions = { ["code"] = code }
            });
    });
});
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseMiddleware<DeviceKeyMiddleware>();
app.UseMiddleware<IdempotencyMiddleware>();
app.MapTabletEndpoints();

var exerciseMedia = app.Services.GetRequiredService<ExerciseVideoProcessor>();
Directory.CreateDirectory(exerciseMedia.StoragePath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(exerciseMedia.StoragePath),
    RequestPath = "/media/exercises"
});
app.UseDefaultFiles();
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/health/live", () => Results.Ok(new { status = "ok" }));
app.MapGet(
    "/health/ready",
    async (UnderFitDbContext database, CancellationToken cancellationToken) =>
        await database.Database.CanConnectAsync(cancellationToken)
            ? Results.Ok(new { status = "ready" })
            : Results.Problem(
                title: "PostgreSQL is unavailable.",
                statusCode: StatusCodes.Status503ServiceUnavailable));

var mobileAuth = app.MapGroup("/api/v1/mobile/auth").WithTags("Mobile authentication");
mobileAuth.MapPost(
    "/login",
    (MemberMobileLoginRequest request, MemberMobileAuthService service, CancellationToken ct) =>
        service.LoginAsync(request, ct));
mobileAuth.MapPost(
    "/first-use",
    (MemberMobileFirstUseRequest request, MemberMobileAuthService service, CancellationToken ct) =>
        service.FirstUseAsync(request, ct))
    .RequireRateLimiting("mobile-first-use");
mobileAuth.MapPost(
    "/refresh",
    (MemberMobileRefreshRequest request, MemberMobileAuthService service, CancellationToken ct) =>
        service.RefreshAsync(request, ct));
mobileAuth.MapPost(
    "/logout",
    async (MemberMobileLogoutRequest request, MemberMobileAuthService service, CancellationToken ct) =>
    {
        await service.LogoutAsync(request, ct);
        return Results.NoContent();
    });

var mobile = app.MapGroup("/api/v1/mobile").WithTags("Mobile").RequireAuthorization(
    policy => policy.RequireRole("Member"));
mobile.MapGet(
    "/me",
    async (ClaimsPrincipal principal, UnderFitDbContext database, TimeProvider clock, CancellationToken ct) =>
    {
        var subject = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var memberId))
        {
            return Results.Unauthorized();
        }
        var member = await database.Members.SingleOrDefaultAsync(item => item.Id == memberId, ct);
        if (member is null)
        {
            return Results.NotFound();
        }
        var today = DateOnly.FromDateTime(clock.GetLocalNow().DateTime);
        return Results.Ok(new MemberMobileProfileResponse(
            member.IdentityNumber,
            member.Name,
            member.Email,
            member.Phone,
            member.CurrentMembershipPlan.ToString(),
            member.MembershipExpiresOn,
            member.DaysRemainingOn(today)));
    });
mobile.MapGet(
    "/workout-plan",
    async (
        ClaimsPrincipal principal,
        TrainingService service,
        CancellationToken ct) =>
    {
        var subject = principal.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var memberId)) return Results.Unauthorized();
        var plan = await service.GetActivePlanAsync(memberId, ct);
        return plan is null ? Results.NotFound() : Results.Ok(plan);
    });
mobile.MapGet(
    "/classes",
    async (
        ClaimsPrincipal principal,
        ClassService service,
        CancellationToken ct) =>
    {
        var subject = principal.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var memberId)) return Results.Unauthorized();
        return Results.Ok(await service.ListMemberCalendarAsync(memberId, ct));
    });
mobile.MapGet(
    "/classes/available",
    async (ClaimsPrincipal principal, ClassService service, CancellationToken ct) =>
    {
        var subject = principal.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var memberId)) return Results.Unauthorized();
        return Results.Ok(await service.ListMemberAvailabilityAsync(memberId, ct));
    });
mobile.MapPost(
    "/classes/{classId:int}/enrollment",
    async (int classId, ClaimsPrincipal principal, ClassService service, CancellationToken ct) =>
    {
        var subject = principal.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var memberId)) return Results.Unauthorized();
        return Results.Ok(await service.EnrollOccurrenceAsync(memberId, classId, ct));
    });
mobile.MapDelete(
    "/classes/{classId:int}/enrollment",
    async (int classId, ClaimsPrincipal principal, ClassService service, CancellationToken ct) =>
    {
        var subject = principal.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var memberId)) return Results.Unauthorized();
        return Results.Ok(await service.CancelOccurrenceAsync(memberId, classId, ct));
    });
mobile.MapGet(
    "/history",
    async (
        ClaimsPrincipal principal,
        MemberMobileHistoryService service,
        CancellationToken ct) =>
    {
        var subject = principal.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var memberId)) return Results.Unauthorized();
        return Results.Ok(await service.GetAsync(memberId, ct));
    });
mobile.MapPost(
    "/change-password",
    async (
        ClaimsPrincipal principal,
        MemberMobileChangePasswordRequest request,
        MemberMobileAuthService service,
        CancellationToken ct) =>
    {
        var subject = principal.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var memberId)) return Results.Unauthorized();
        return Results.Ok(await service.ChangePasswordAsync(memberId, request, ct));
    });

mobile.MapPost(
    "/account-deletion-request",
    async (
        ClaimsPrincipal principal,
        MemberAccountDeletionService service,
        CancellationToken ct) =>
    {
        var subject = principal.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var memberId)) return Results.Unauthorized();
        return Results.Ok(await service.RequestAsync(memberId, ct));
    });

var accountDeletion = app.MapGroup("/api/v1/admin/account-deletion-requests")
    .WithTags("Administration - Account deletion");
accountDeletion.MapGet(
    "/",
    (bool? pendingOnly, MemberAccountDeletionService service, CancellationToken ct) =>
        service.ListAsync(pendingOnly != false, ct));
accountDeletion.MapPut(
    "/{requestId:guid}",
    (
        Guid requestId,
        ResolveMemberAccountDeletionRequest request,
        MemberAccountDeletionService service,
        CancellationToken ct) =>
        service.ResolveAsync(requestId, request, ct));

// These operations belong exclusively to the administration surface. Before the
// API is exposed publicly, this group will require the administration policy.
var adminTraining = app.MapGroup("/api/v1/admin/training").WithTags("Administration - Training");
adminTraining.MapGet(
    "/exercises",
    (bool includeInactive, TrainingService service, CancellationToken ct) =>
        service.ListExercisesAsync(includeInactive, ct));
adminTraining.MapPost(
    "/exercises",
    async (CreateExerciseRequest request, TrainingService service, CancellationToken ct) =>
    {
        var created = await service.CreateExerciseAsync(request, ct);
        return Results.Created($"/api/v1/admin/training/exercises/{created.Id}", created);
    });
adminTraining.MapPut(
    "/exercises/{exerciseId:int}",
    (int exerciseId, UpdateExerciseRequest request, TrainingService service, CancellationToken ct) =>
        service.UpdateExerciseAsync(exerciseId, request, ct));
adminTraining.MapGet(
    "/templates",
    (TrainingService service, CancellationToken ct) =>
        service.ListTemplatesAsync(ct));
adminTraining.MapGet(
    "/member-plans",
    (TrainingService service, CancellationToken ct) =>
        service.ListActiveMemberPlansAsync(ct));
adminTraining.MapPost(
    "/templates",
    async (SaveWorkoutTemplateRequest request, TrainingService service, CancellationToken ct) =>
    {
        var created = await service.SaveTemplateAsync(request, ct);
        return Results.Created($"/api/v1/admin/training/templates/{created.Id}", created);
    });
adminTraining.MapPost(
    "/media",
    async (HttpRequest request, ExerciseVideoProcessor processor, CancellationToken ct) =>
    {
        if (!request.HasFormContentType)
            return Results.BadRequest(new { title = "Arrastrá un archivo de video válido." });
        var form = await request.ReadFormAsync(ct);
        var file = form.Files.GetFile("file");
        if (file is null)
            return Results.BadRequest(new { title = "No se recibió el video." });
        try
        {
            var name = await processor.ProcessAsync(file, ct);
            var mediaUrl = $"/media/exercises/{name}";
            var previewUrl = $"{request.Scheme}://{request.Host}{mediaUrl}";
            return Results.Ok(new { mediaUrl, previewUrl });
        }
        catch (InvalidOperationException exception)
        {
            return Results.BadRequest(new { title = exception.Message });
        }
    })
    .DisableAntiforgery();

var adminMemberTraining = app.MapGroup("/api/v1/admin/members")
    .WithTags("Administration - Member training");
adminMemberTraining.MapPut(
    "/{identityNumber}/workout-plan",
    (
        string identityNumber,
        AssignWorkoutPlanRequest request,
        TrainingService service,
        CancellationToken ct) =>
        service.AssignPlanAsync(identityNumber, request, ct));

var members = app.MapGroup("/api/v1/members").WithTags("Members");

members.MapPut(
    "/by-identity/{identityNumber}/mobile-access",
    async (
        string identityNumber,
        ConfigureMemberMobileAccessRequest request,
        MemberMobileAuthService service,
        CancellationToken cancellationToken) =>
    {
        await service.ConfigureAsync(identityNumber, request, cancellationToken);
        return Results.NoContent();
    });

members.MapGet(
    "/",
    (MemberService service, CancellationToken cancellationToken) =>
        service.ListAsync(cancellationToken));

members.MapPost(
    "/",
    async (CreateMemberRequest request, MemberService service, CancellationToken cancellationToken) =>
        Results.Created(
            $"/api/v1/members/by-identity/{Uri.EscapeDataString(request.IdentityNumber)}",
            await service.CreateAsync(request, cancellationToken)));

members.MapGet(
    "/by-identity/{identityNumber}",
    (string identityNumber, MemberService service, CancellationToken cancellationToken) =>
        service.GetByIdentityAsync(identityNumber, cancellationToken));

members.MapPut(
    "/by-identity/{identityNumber}",
    (string identityNumber, UpdateMemberRequest request, MemberService service, CancellationToken cancellationToken) =>
        service.UpdateAsync(identityNumber, request, cancellationToken));

members.MapDelete(
    "/by-identity/{identityNumber}",
    (
        string identityNumber,
        MemberService service,
        CancellationToken cancellationToken) =>
        service.DeleteAsync(identityNumber, cancellationToken));

members.MapPost(
    "/{memberId:guid}/renewals",
    (Guid memberId, RenewMembershipRequest request, MemberService service, CancellationToken cancellationToken) =>
        service.RenewAsync(memberId, request, cancellationToken));

members.MapGet(
    "/by-identity/{identityNumber}/renewals",
    (string identityNumber, MemberService service, CancellationToken cancellationToken) =>
        service.ListRenewalsAsync(identityNumber, cancellationToken));

members.MapPost(
    "/by-identity/{identityNumber}/renewals",
    (
        string identityNumber,
        RenewMembershipRequest request,
        MemberService service,
        CancellationToken cancellationToken) =>
        service.RenewByIdentityAsync(identityNumber, request, cancellationToken));

app.MapPost(
    "/api/v1/cash-sessions",
    async (
        OpenCashSessionRequest request,
        CashSessionService service,
        CancellationToken cancellationToken) =>
        Results.Created(
            "/api/v1/cash-sessions/current",
            await service.OpenAsync(request, cancellationToken)))
    .WithTags("Cash");

app.MapPost(
    "/api/v1/cash-sessions/current/close",
    (
        CloseCashSessionRequest request,
        CashSessionService service,
        CancellationToken cancellationToken) =>
        service.CloseAsync(request, cancellationToken))
    .WithTags("Cash");

app.MapGet(
    "/api/v1/cash-sessions/by-date/{businessDate}/closure",
    (
        DateOnly businessDate,
        CashSessionService service,
        CancellationToken cancellationToken) =>
        service.GetClosureAsync(businessDate, cancellationToken))
    .WithTags("Cash");

app.MapGet(
    "/api/v1/cash-sessions/by-date/{businessDate}/summary",
    (
        DateOnly businessDate,
        CashSessionService service,
        CancellationToken cancellationToken) =>
        service.GetSummaryAsync(businessDate, cancellationToken))
    .WithTags("Cash");

app.MapGet(
    "/api/v1/cash-sessions/by-date/{businessDate}/report",
    (
        DateOnly businessDate,
        CashSessionService service,
        CancellationToken cancellationToken) =>
        service.GetDailyReportAsync(businessDate, cancellationToken))
    .WithTags("Cash");

app.MapPost(
    "/api/v1/cash-movements/manual-income",
    (
        CreateManualCashMovementRequest request,
        CashSessionService service,
        CancellationToken cancellationToken) =>
        service.RegisterManualIncomeAsync(request, cancellationToken))
    .WithTags("Cash");

app.MapPost(
    "/api/v1/cash-movements/outputs",
    (
        CreateManualCashMovementRequest request,
        CashSessionService service,
        CancellationToken cancellationToken) =>
        service.RegisterCashOutputAsync(request, cancellationToken))
    .WithTags("Cash");

app.MapPost(
    "/api/v1/cash-movements/adjustments",
    (
        AdjustCashTotalRequest request,
        CashSessionService service,
        CancellationToken cancellationToken) =>
        service.AdjustTotalAsync(request, cancellationToken))
    .WithTags("Cash");

app.MapPost(
    "/api/v1/cash-movements/{movementId:guid}/corrections",
    (
        Guid movementId,
        CorrectCashMovementRequest request,
        CashSessionService service,
        CancellationToken cancellationToken) =>
        service.CorrectMovementAsync(movementId, request, cancellationToken))
    .WithTags("Cash");

app.MapGet(
    "/api/v1/cash-sessions/current",
    (CashSessionService service, CancellationToken cancellationToken) =>
        service.GetCurrentAsync(cancellationToken))
    .WithTags("Cash");

app.MapGet(
    "/api/v1/settings/membership-prices",
    (MembershipPriceService service, CancellationToken cancellationToken) =>
        service.GetAsync(cancellationToken))
    .WithTags("Settings");

app.MapPut(
    "/api/v1/settings/membership-prices",
    (
        UpdateMembershipPricesRequest request,
        MembershipPriceService service,
        CancellationToken cancellationToken) =>
        service.UpdateAsync(request, cancellationToken))
    .WithTags("Settings");

app.MapPost(
    "/api/v1/entries",
    (RegisterEntryRequest request, AttendanceService service, CancellationToken cancellationToken) =>
        service.RegisterAsync(request, cancellationToken))
    .WithTags("Attendance");

var classes = app.MapGroup("/api/v1/classes").WithTags("Classes");
classes.MapDelete("/{classId:int}", (int classId, ClassService service, CancellationToken ct) => service.DeleteAsync(classId, ct));
classes.MapGet("/agenda", (DateOnly from, ClassService service, CancellationToken ct) => service.ListAgendaAsync(from, ct));
classes.MapGet(
    "/",
    (
        DateOnly? from,
        ClassService service,
        CancellationToken cancellationToken) =>
        service.ListAsync(from ?? DateOnly.FromDateTime(DateTime.Today), cancellationToken));
classes.MapPost(
    "/",
    async (
        CreateClassRequest request,
        ClassService service,
        CancellationToken cancellationToken) =>
        Results.Ok(await service.CreateAsync(request, cancellationToken)));
classes.MapPost(
    "/schedules",
    async (
        CreateClassScheduleRequest request,
        ClassService service,
        CancellationToken cancellationToken) =>
        Results.Ok(await service.CreateScheduleAsync(request, cancellationToken)));
classes.MapGet(
    "/{classId:int}/enrollments",
    (
        int classId,
        ClassService service,
        CancellationToken cancellationToken) =>
        service.ListEnrollmentsAsync(classId, cancellationToken));
classes.MapPost(
    "/{classId:int}/enrollments",
    (
        int classId,
        EnrollClassRequest request,
        ClassService service,
        CancellationToken cancellationToken) =>
        service.EnrollAsync(classId, request, cancellationToken));
classes.MapDelete(
    "/{classId:int}/enrollments/{identityNumber}",
    (
        int classId,
        string identityNumber,
        ClassService service,
        CancellationToken cancellationToken) =>
        service.RemoveEnrollmentAsync(classId, identityNumber, cancellationToken));
classes.MapGet("/current",(int locationId,DateOnly? date,TimeOnly? time,ClassService s,CancellationToken ct)=>s.GetCurrentAsync(locationId,date,time,ct));
classes.MapPost("/attendance",(RegisterClassAttendanceRequest r,ClassService s,CancellationToken ct)=>s.RegisterAttendanceAsync(r,ct));
classes.MapGet("/records",(DateOnly date,ClassService s,CancellationToken ct)=>s.ListRecordsAsync(date,ct));
classes.MapGet("/{classId:int}/record",(int classId,ClassService s,CancellationToken ct)=>s.GetRecordDetailAsync(classId,ct));
classes.MapPut("/{classId:int}/held-status",(int classId,SetClassHeldStatusRequest r,ClassService s,CancellationToken ct)=>s.SetHeldStatusAsync(classId,r,ct));
classes.MapPut("/{classId:int}/trial",(int classId,SetClassTrialRequest r,ClassService s,CancellationToken ct)=>s.SetTrialAsync(classId,r,ct));
classes.MapPut(
    "/attendances/{attendanceId:guid}/rating",
    (Guid attendanceId, SetClassPerformanceRatingRequest request,
        ClassService service, CancellationToken ct) =>
        service.SetPerformanceRatingAsync(attendanceId, request, ct));
classes.MapPut(
    "/{classId:int}/attendance-correction",
    (int classId, CorrectClassAttendanceRequest request,
        ClassService service, CancellationToken ct) =>
        service.CorrectAttendanceAsync(classId, request, ct));

var staff = app.MapGroup("/api/v1/staff").WithTags("Staff");
staff.MapGet("/", (bool? includeInactive, StaffService s, CancellationToken ct) => s.ListAsync(includeInactive == true, ct));
staff.MapPost("/", (CreateProfessorRequest r, StaffService s, CancellationToken ct) => s.CreateAsync(r, ct));
staff.MapPut("/{id:int}", (int id, UpdateProfessorRequest r, StaffService s, CancellationToken ct) => s.UpdateAsync(id, r, ct));
staff.MapPost("/sessions", (StartProfessorSessionRequest r, StaffService s, CancellationToken ct) => s.StartAsync(r, ct));
staff.MapGet("/sessions/current", (string deviceId, StaffService s, CancellationToken ct) => s.CurrentAsync(deviceId, ct));
staff.MapPost("/sessions/{id:int}/finish", (int id, StaffService s, CancellationToken ct) => s.FinishAsync(id, ct));

app.MapGet("/api/v1/entries/latest", async (UnderFitDbContext db, TimeProvider clock, CancellationToken ct) =>
{
    var rows = await db.Entries.AsNoTracking().Where(x => !x.IsAnnulled)
        .GroupBy(x => x.MemberIdentityNumber)
        .Select(group => new { Ci = group.Key, Last = group.Max(x => x.OccurredAtUtc) })
        .ToArrayAsync(ct);
    return rows.Select(row => {
        var local = TimeZoneInfo.ConvertTime(row.Last, clock.LocalTimeZone);
        return new { ci = row.Ci, fecha = DateOnly.FromDateTime(local.DateTime), hora = TimeOnly.FromDateTime(local.DateTime) };
    }).ToArray();
}).WithTags("Attendance");

app.MapGet(
    "/api/v1/entries",
    (
        DateOnly? from,
        DateOnly? to,
        string? identityNumber,
        AttendanceService service,
        CancellationToken cancellationToken) =>
        service.ListAsync(from, to, cancellationToken, identityNumber))
    .WithTags("Attendance");

app.MapPost(
    "/api/v1/entries/{entryId:guid}/annulment",
    (
        Guid entryId,
        AnnulEntryRequest request,
        AttendanceService service,
        CancellationToken cancellationToken) =>
        service.AnnulAsync(entryId, request, cancellationToken))
    .WithTags("Attendance");

var products = app.MapGroup("/api/v1/products").WithTags("Inventory");
products.MapGet("/", (InventoryService service, CancellationToken ct) =>
    service.ListProductsAsync(ct));
products.MapPost("/", (SaveProductRequest request, InventoryService service, CancellationToken ct) =>
    service.CreateProductAsync(request, ct));
products.MapPut("/{id:int}", (int id, SaveProductRequest request, InventoryService service, CancellationToken ct) =>
    service.UpdateProductAsync(id, request, ct));
products.MapDelete("/{id:int}", (int id, InventoryService service, CancellationToken ct) =>
    service.DeleteProductAsync(id, ct));
products.MapPost("/{id:int}/sales", (int id, SellProductRequest request, InventoryService service, CancellationToken ct) =>
    service.SellProductAsync(id, request, ct));
products.MapGet("/sales/by-date/{date}", (DateOnly date, InventoryService service, CancellationToken ct) =>
    service.ListSalesAsync(date, ct));
products.MapGet("/sales/by-date/{date}/total", (DateOnly date, InventoryService service, CancellationToken ct) =>
    service.GetSalesTotalAsync(date, ct));
products.MapGet("/pending-sales", (InventoryService service, CancellationToken ct) =>
    service.ListPendingSalesAsync(ct));
products.MapGet("/pending-sales/summary/{date}", (DateOnly date, InventoryService service, CancellationToken ct) =>
    service.GetPendingSummaryAsync(date, ct));
products.MapPost("/pending-sales", (CreatePendingSaleRequest request, InventoryService service, CancellationToken ct) =>
    service.CreatePendingSaleAsync(request, ct));
products.MapPost("/pending-sales/{id:int}/collection", (
    int id, CollectPendingSaleRequest request, InventoryService service, CancellationToken ct) =>
    service.CollectPendingSaleAsync(id, request, ct));

var businessSettings = app.MapGroup("/api/v1/settings/business").WithTags("Settings");
businessSettings.MapGet("/", (BusinessSettingsService service, CancellationToken ct) =>
    service.GetAsync(ct));
businessSettings.MapPut("/", (
    UpdateRunningEventSettingsRequest request,
    BusinessSettingsService service,
    CancellationToken ct) => service.UpdateAsync(request, ct));

app.Run();

public partial class Program;
