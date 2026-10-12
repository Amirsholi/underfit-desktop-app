using Microsoft.EntityFrameworkCore;
using UnderFit.Application.Attendance;
using UnderFit.Application.Cash;
using UnderFit.Application.Classes;
using UnderFit.Application.Staff;
using UnderFit.Application.Common;
using UnderFit.Application.Members;
using UnderFit.Application.Inventory;
using UnderFit.Application.Mobile;
using UnderFit.Application.Abstractions;
using UnderFit.Contracts.Attendance;
using UnderFit.Contracts.Cash;
using UnderFit.Contracts.Classes;
using UnderFit.Contracts.Staff;
using UnderFit.Contracts.Members;
using UnderFit.Contracts.Inventory;
using UnderFit.Contracts.Mobile;
using UnderFit.Domain.Cash;
using UnderFit.Domain.Members;
using UnderFit.Infrastructure.Persistence;
using Xunit;

namespace UnderFit.IntegrationTests.PostgreSql;

public sealed class PostgreSqlVerticalSliceTests
{
    private const string DefaultConnectionString =
        "Host=localhost;Port=5432;Database=underfit;Username=underfit;Password=underfit_dev";

    [Fact]
    public async Task MobileAccountDeletionRequest_RevokesAccessAndPreservesMemberRecords()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using var database = CreateDatabase();
        await database.Database.MigrateAsync(cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var now = new DateTimeOffset(2026, 7, 29, 15, 0, 0, TimeSpan.Zero);
        var clock = new FixedTimeProvider(now);
        var identity = Guid.NewGuid().ToString("N");
        var memberResponse = await new MemberService(database, clock).CreateAsync(
            CreateRequest(identity, "Deletion Request Member", MembershipPlan.Monthly, new DateOnly(2026, 7, 29)),
            cancellationToken);
        var authentication = new MemberMobileAuthService(database, new FakeTokenIssuer(), clock);
        await authentication.FirstUseAsync(
            new MemberMobileFirstUseRequest(identity, "MiClave2026"),
            cancellationToken);
        var service = new MemberAccountDeletionService(database, clock);

        var request = await service.RequestAsync(memberResponse.Member.Id, cancellationToken);
        var member = await database.FindMemberByIdentityAsync(identity, cancellationToken);
        var account = await database.FindMemberMobileAccountAsync(
            memberResponse.Member.Id,
            cancellationToken);
        var login = await Assert.ThrowsAsync<UseCaseException>(
            () => authentication.LoginAsync(
                new MemberMobileLoginRequest(identity, "MiClave2026"),
                cancellationToken));
        var reset = await Assert.ThrowsAsync<UseCaseException>(
            () => authentication.ConfigureAsync(
                identity,
                new ConfigureMemberMobileAccessRequest("OtraClave2026"),
                cancellationToken));
        var listed = await service.ListAsync(true, cancellationToken);

        Assert.Equal("Pending", request.Status);
        Assert.NotNull(member);
        Assert.False(account!.IsActive);
        Assert.Equal("mobile_auth.invalid_credentials", login.Code);
        Assert.Equal("account_deletion.pending", reset.Code);
        Assert.Contains(listed, item => item.Id == request.Id);
        await transaction.RollbackAsync(cancellationToken);
    }

    [Fact]
    public async Task MobileFirstUse_CreatesPasswordOnceAndReturnsAuthenticatedSession()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using var database = CreateDatabase();
        await database.Database.MigrateAsync(cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var now = new DateTimeOffset(2026, 7, 29, 12, 0, 0, TimeSpan.Zero);
        var clock = new FixedTimeProvider(now);
        var identity = Guid.NewGuid().ToString("N");
        await new MemberService(database, clock).CreateAsync(
            CreateRequest(identity, "First Use Member", MembershipPlan.Monthly, new DateOnly(2026, 7, 29)),
            cancellationToken);
        var service = new MemberMobileAuthService(database, new FakeTokenIssuer(), clock);

        var session = await service.FirstUseAsync(
            new MemberMobileFirstUseRequest(identity, "MiClave2026"),
            cancellationToken);
        var duplicate = await Assert.ThrowsAsync<UseCaseException>(
            () => service.FirstUseAsync(
                new MemberMobileFirstUseRequest(identity, "OtraClave2026"),
                cancellationToken));
        var member = await database.FindMemberByIdentityAsync(identity, cancellationToken);
        var changed = await service.ChangePasswordAsync(
            member!.Id,
            new MemberMobileChangePasswordRequest("MiClave2026", "ClaveNueva2026"),
            cancellationToken);
        var oldPassword = await Assert.ThrowsAsync<UseCaseException>(
            () => service.LoginAsync(
                new MemberMobileLoginRequest(identity, "MiClave2026"),
                cancellationToken));
        var newLogin = await service.LoginAsync(
            new MemberMobileLoginRequest(identity, "ClaveNueva2026"),
            cancellationToken);

        Assert.Equal(identity, session.Member.IdentityNumber);
        Assert.Equal("integration-access-token", session.AccessToken);
        Assert.NotEmpty(session.RefreshToken);
        Assert.Equal("mobile_auth.already_configured", duplicate.Code);
        Assert.Equal("mobile_auth.invalid_credentials", oldPassword.Code);
        Assert.Equal(identity, changed.Member.IdentityNumber);
        Assert.Equal(identity, newLogin.Member.IdentityNumber);
    }

    [Fact]
    public async Task ActiveMember_CanBeCreatedAndEnterThroughPostgreSql()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using var database = CreateDatabase();
        await database.Database.MigrateAsync(cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var now = new DateTimeOffset(2026, 7, 27, 12, 0, 0, TimeSpan.Zero);
        var timeProvider = new FixedTimeProvider(now);
        var memberService = new MemberService(database, timeProvider);
        var cashSessionService = new CashSessionService(database, timeProvider);
        var attendanceService = new AttendanceService(database, timeProvider);
        var identityNumber = Guid.NewGuid().ToString("N");

        var member = await memberService.CreateAsync(
            CreateRequest(
                identityNumber,
                "Integration Member",
                MembershipPlan.Monthly,
                new DateOnly(2026, 7, 1)),
            cancellationToken);
        var updated = await memberService.UpdateAsync(
            identityNumber,
            new UpdateMemberRequest(
                "Updated Integration Member",
                MembershipPlan.Quarterly,
                45,
                "099999999",
                "updated@example.com",
                "Updated details",
                "Updated Emergency Contact",
                "098999999",
                false,
                new DateOnly(1991, 2, 2),
                "Updated Address",
                "Friend",
                "Updated condition",
                "Updated goal",
                "transfer",
                "transfer"),
            cancellationToken);

        var entry = await attendanceService.RegisterAsync(
            new RegisterEntryRequest(
                identityNumber,
                "integration-test",
                "test-device",
                now,
                "Integration observation",
                2,
                7),
            cancellationToken);
        var listedEntries = await attendanceService.ListAsync(
            new DateOnly(2026, 7, 27),
            new DateOnly(2026, 7, 27),
            cancellationToken);
        database.MembershipPrices.Add(new MembershipPrice(MembershipPlan.Quarterly, 1500m));
        database.CashSessions.Add(CashSession.Open(
            new DateOnly(2026, 7, 27),
            "Integration Cashier",
            500m,
            now));
        await database.SaveChangesAsync(cancellationToken);
        var renewal = await memberService.RenewByIdentityAsync(
            identityNumber,
            new RenewMembershipRequest(
                MembershipPlan.Quarterly,
                new DateOnly(2026, 7, 27),
                "transferencia"),
            cancellationToken);
        var renewalHistory = await memberService.ListRenewalsAsync(identityNumber, cancellationToken);
        await cashSessionService.RegisterManualIncomeAsync(
            new CreateManualCashMovementRequest(
                new DateOnly(2026, 7, 27),
                100m,
                "efectivo",
                "Integration income"),
            cancellationToken);
        var output = await cashSessionService.RegisterCashOutputAsync(
            new CreateManualCashMovementRequest(
                new DateOnly(2026, 7, 27),
                50m,
                "transferencia",
                "Integration output"),
            cancellationToken);
        var adjustment = await cashSessionService.AdjustTotalAsync(
            new AdjustCashTotalRequest(
                new DateOnly(2026, 7, 27),
                1600m,
                "Integration adjustment"),
            cancellationToken);
        var correction = await cashSessionService.CorrectMovementAsync(
            output.Id,
            new CorrectCashMovementRequest(
                40m,
                "transferencia",
                "Corrected integration output",
                "Incorrect amount"),
            cancellationToken);
        var openSummary = await cashSessionService.GetSummaryAsync(
            new DateOnly(2026, 7, 27),
            cancellationToken);
        var closure = await cashSessionService.CloseAsync(
            new CloseCashSessionRequest(
                new DateOnly(2026, 7, 27),
                590m,
                "Integration difference",
                "Integration Supervisor"),
            cancellationToken);
        var persistedClosure = await cashSessionService.GetClosureAsync(
            new DateOnly(2026, 7, 27),
            cancellationToken);
        var dailyReport = await cashSessionService.GetDailyReportAsync(
            new DateOnly(2026, 7, 27),
            cancellationToken);
        var members = await memberService.ListAsync(cancellationToken);

        Assert.Equal(member.Member.Id, entry.MemberId);
        Assert.Equal("Updated Integration Member", updated.Name);
        Assert.Equal("Updated Address", updated.Address);
        Assert.Equal("transfer", updated.PaymentPreference);
        Assert.Equal(MembershipPlan.Quarterly, updated.CurrentMembershipPlan);
        Assert.Equal(45, updated.DaysRemaining);
        Assert.Equal(1500m, renewal.Renewal.Amount);
        Assert.Equal("transferencia", renewal.Renewal.PaymentMethod);
        Assert.NotNull(renewal.Renewal.CashMovementId);
        Assert.Single(renewalHistory);
        Assert.Equal(6, await database.CashMovements.CountAsync(cancellationToken));
        Assert.Equal("abierta", openSummary.Status);
        Assert.Equal(1610m, openSummary.TotalIncome);
        Assert.Equal(600m, openSummary.ExpectedCash);
        Assert.Equal(6, openSummary.Movements.Count);
        Assert.True(adjustment.Applied);
        Assert.Equal(50m, adjustment.Difference);
        Assert.True(correction.Corrected);
        Assert.Equal(output.Id, correction.OriginalId);
        Assert.Equal(1610m, closure.TotalIncome);
        Assert.Equal(100m, closure.TotalCash);
        Assert.Equal(1460m, closure.TotalTransfer);
        Assert.Equal(600m, closure.ExpectedCash);
        Assert.Equal(590m, closure.CountedCash);
        Assert.Equal(-10m, closure.CashDifference);
        Assert.Equal("Integration Supervisor", closure.ClosingCashier);
        Assert.Equal(closure, persistedClosure);
        Assert.Single(dailyReport.Sessions);
        Assert.Equal(1610m, dailyReport.Sessions[0].TotalIncome);
        Assert.Equal("cerrada", dailyReport.Sessions[0].Status);
        Assert.Equal(45, entry.DaysRemaining);
        Assert.Contains(members, item => item.IdentityNumber == identityNumber);
        Assert.Equal(1, await database.Entries.CountAsync(cancellationToken));
        Assert.Single(listedEntries);
        Assert.Equal(identityNumber, listedEntries[0].IdentityNumber);
        Assert.Equal("Integration observation", listedEntries[0].Observation);
        Assert.Equal(2, listedEntries[0].LocationId);
        Assert.Equal(7, listedEntries[0].ClassId);
        var annulled = await attendanceService.AnnulAsync(
            entry.EntryId,
            new AnnulEntryRequest("Integration duplicate"),
            cancellationToken);
        Assert.True(annulled.Annulled);
        Assert.Empty(await attendanceService.ListAsync(
            new DateOnly(2026, 7, 27),
            new DateOnly(2026, 7, 27),
            cancellationToken));
        await transaction.RollbackAsync(cancellationToken);
    }

    [Fact]
    public async Task ExpiredMember_IsDeniedAndDoesNotCreateAnEntry()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using var database = CreateDatabase();
        await database.Database.MigrateAsync(cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var now = new DateTimeOffset(2026, 7, 27, 12, 0, 0, TimeSpan.Zero);
        var timeProvider = new FixedTimeProvider(now);
        var memberService = new MemberService(database, timeProvider);
        var attendanceService = new AttendanceService(database, timeProvider);
        var identityNumber = Guid.NewGuid().ToString("N");

        await memberService.CreateAsync(
            CreateRequest(
                identityNumber,
                "Expired Integration Member",
                MembershipPlan.Monthly,
                new DateOnly(2026, 5, 1)),
            cancellationToken);

        var exception = await Assert.ThrowsAsync<UseCaseException>(
            () => attendanceService.RegisterAsync(
                new RegisterEntryRequest(identityNumber, "integration-test", "test-device", now),
                cancellationToken));

        Assert.Equal("access.membership_expired", exception.Code);
        Assert.Equal(0, await database.Entries.CountAsync(cancellationToken));
        await transaction.RollbackAsync(cancellationToken);
    }

    [Fact]
    public async Task PaidRenewal_WithoutOpenCash_DoesNotChangeMemberOrCreateFinancialRecords()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using var database = CreateDatabase();
        await database.Database.MigrateAsync(cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var now = new DateTimeOffset(2026, 7, 27, 12, 0, 0, TimeSpan.Zero);
        var memberService = new MemberService(database, new FixedTimeProvider(now));
        var identityNumber = Guid.NewGuid().ToString("N");

        var member = await memberService.CreateAsync(
            CreateRequest(
                identityNumber,
                "Renewal Safety Member",
                MembershipPlan.Monthly,
                new DateOnly(2026, 7, 1)),
            cancellationToken);
        database.MembershipPrices.Add(new MembershipPrice(MembershipPlan.Monthly, 900m));
        await database.SaveChangesAsync(cancellationToken);
        var renewalCount = await database.MembershipRenewals.CountAsync(cancellationToken);
        var movementCount = await database.CashMovements.CountAsync(cancellationToken);

        var exception = await Assert.ThrowsAsync<UseCaseException>(
            () => memberService.RenewByIdentityAsync(
                identityNumber,
                new RenewMembershipRequest(
                    MembershipPlan.Monthly,
                    new DateOnly(2026, 7, 27),
                    "efectivo"),
                cancellationToken));

        database.ChangeTracker.Clear();
        var unchangedMember = await memberService.GetByIdentityAsync(identityNumber, cancellationToken);
        Assert.Equal("cash.not_open", exception.Code);
        Assert.Equal(member.Member.MembershipExpiresOn, unchangedMember.MembershipExpiresOn);
        Assert.Equal(renewalCount, await database.MembershipRenewals.CountAsync(cancellationToken));
        Assert.Equal(movementCount, await database.CashMovements.CountAsync(cancellationToken));
        await transaction.RollbackAsync(cancellationToken);
    }

    [Fact]
    public async Task PaidRegistration_AndDeletion_PreserveTheLegacyContractAndFinancialAudit()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using var database = CreateDatabase();
        await database.Database.MigrateAsync(cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var now = new DateTimeOffset(2026, 7, 27, 12, 0, 0, TimeSpan.Zero);
        var timeProvider = new FixedTimeProvider(now);
        var memberService = new MemberService(database, timeProvider);
        var cashService = new CashSessionService(database, timeProvider);
        var identityNumber = Guid.NewGuid().ToString("N");
        database.RegistrationPrices.Add(new RegistrationPrice(300m));
        await database.SaveChangesAsync(cancellationToken);
        await cashService.OpenAsync(
            new OpenCashSessionRequest(
                new DateOnly(2026, 7, 27),
                "Registration Cashier",
                500m),
            cancellationToken);

        var created = await memberService.CreateAsync(
            CreateRequest(
                identityNumber,
                "Paid Registration Member",
                MembershipPlan.Monthly,
                new DateOnly(2026, 7, 27)),
            cancellationToken);
        var deleted = await memberService.DeleteAsync(identityNumber, cancellationToken);

        database.ChangeTracker.Clear();
        var movement = await database.CashMovements.SingleAsync(
            item => item.Id == created.CashMovement!.Id,
            cancellationToken);
        Assert.Equal("Paid Registration Member", created.Member.Name);
        Assert.Equal(CashMovementType.Registration, movement.Type);
        Assert.Equal(300m, movement.Amount);
        Assert.Equal("efectivo", movement.PaymentMethod);
        Assert.True(deleted.Success);
        Assert.Equal(1, deleted.Changes);
        Assert.Null(movement.MemberId);
        Assert.False(await database.Members.AnyAsync(
            item => item.IdentityNumber == identityNumber,
            cancellationToken));
        Assert.Equal(
            new DeleteMemberResponse(true, 0),
            await memberService.DeleteAsync(identityNumber, cancellationToken));
        await transaction.RollbackAsync(cancellationToken);
    }

    [Fact]
    public async Task RecurringClassEnrollment_AppliesToEveryOccurrenceAndRejectsDuplicates()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using var database = CreateDatabase();
        await database.Database.MigrateAsync(cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var now = new DateTimeOffset(2026, 7, 28, 12, 0, 0, TimeSpan.Zero);
        var timeProvider = new FixedTimeProvider(now);
        var memberService = new MemberService(database, timeProvider);
        var classService = new ClassService(database, timeProvider);
        var identityNumber = Guid.NewGuid().ToString("N");
        await memberService.CreateAsync(
            CreateRequest(
                identityNumber,
                "Recurring Class Member",
                MembershipPlan.Monthly,
                new DateOnly(2026, 7, 28)),
            cancellationToken);
        var schedule = await classService.CreateScheduleAsync(
            new CreateClassScheduleRequest(
                "Recurring Integration Class",
                2,
                1,
                "Integration Professor",
                [3],
                new TimeOnly(18, 0),
                60,
                1,
                new DateOnly(2026, 7, 29),
                new DateOnly(2026, 8, 12),
                null),
            cancellationToken);
        var occurrences = await classService.ListAsync(
            new DateOnly(2026, 7, 28),
            cancellationToken);
        var first = occurrences.First(item => item.Name == "Recurring Integration Class");

        var enrollment = await classService.EnrollAsync(
            first.Id,
            new EnrollClassRequest(identityNumber),
            cancellationToken);
        var laterOccurrence = occurrences.Last(item => item.Name == "Recurring Integration Class");
        var laterEnrollments = await classService.ListEnrollmentsAsync(
            laterOccurrence.Id,
            cancellationToken);
        var duplicate = await Assert.ThrowsAsync<UseCaseException>(
            () => classService.EnrollAsync(
                laterOccurrence.Id,
                new EnrollClassRequest(identityNumber),
                cancellationToken));
        var removed = await classService.RemoveEnrollmentAsync(
            laterOccurrence.Id,
            identityNumber,
            cancellationToken);
        var historicalEnrollments = await classService.ListEnrollmentsAsync(
            first.Id,
            cancellationToken);
        var futureEnrollments = await classService.ListEnrollmentsAsync(
            laterOccurrence.Id,
            cancellationToken);

        Assert.True(schedule.CreatedOccurrences >= 3);
        Assert.Equal(schedule.Id, enrollment.ScheduleId);
        Assert.Single(laterEnrollments);
        Assert.Equal(identityNumber, laterEnrollments[0].MemberIdentityNumber);
        Assert.Equal("class.already_enrolled", duplicate.Code);
        Assert.True(removed.Removed);
        Assert.Equal(laterOccurrence.Date.AddDays(-1), removed.EffectiveUntil);
        Assert.Single(historicalEnrollments);
        Assert.Empty(futureEnrollments);
        await transaction.RollbackAsync(cancellationToken);
    }

    [Fact]
    public async Task MobileClassBooking_ChangesOnlyTheSelectedOccurrence()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var database = CreateDatabase();
        await database.Database.MigrateAsync(ct);
        await using var transaction = await database.Database.BeginTransactionAsync(ct);
        var now = new DateTimeOffset(2026, 8, 3, 10, 0, 0, TimeSpan.Zero);
        var clock = new FixedTimeProvider(now);
        var classService = new ClassService(database, clock);
        var identity = Guid.NewGuid().ToString("N");
        var member = await new MemberService(database, clock).CreateAsync(
            CreateRequest(identity, "Mobile Booking Member", MembershipPlan.Quarterly,
                new DateOnly(2026, 8, 3)), ct);
        await classService.CreateScheduleAsync(new CreateClassScheduleRequest(
            "Mobile Booking Class", 2, 1, "Integration Professor", [2],
            new TimeOnly(18, 0), 60, 5, new DateOnly(2026, 8, 4),
            new DateOnly(2026, 8, 25), null), ct);
        var occurrences = (await classService.ListAsync(new DateOnly(2026, 8, 3), ct))
            .Where(item => item.Name == "Mobile Booking Class").ToArray();
        var first = occurrences[0];
        var selected = occurrences[1];
        var later = occurrences[2];
        await classService.EnrollAsync(first.Id, new EnrollClassRequest(identity), ct);

        var cancelled = await classService.CancelOccurrenceAsync(
            member.Member.Id, selected.Id, ct);
        var firstMembers = await classService.ListEnrollmentsAsync(first.Id, ct);
        var selectedMembers = await classService.ListEnrollmentsAsync(selected.Id, ct);
        var laterMembers = await classService.ListEnrollmentsAsync(later.Id, ct);
        var restored = await classService.EnrollOccurrenceAsync(
            member.Member.Id, selected.Id, ct);

        Assert.False(cancelled.IsEnrolled);
        Assert.Single(firstMembers);
        Assert.Empty(selectedMembers);
        Assert.Single(laterMembers);
        Assert.True(restored.IsEnrolled);
        Assert.Single(await classService.ListEnrollmentsAsync(selected.Id, ct));
        await transaction.RollbackAsync(ct);
    }

    [Fact]
    public async Task ProfessorPin_ControlsOneActiveTabletSessionPerDevice()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using var database = CreateDatabase();
        await database.Database.MigrateAsync(cancellationToken);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var now = new DateTimeOffset(2026, 7, 28, 12, 0, 0, TimeSpan.Zero);
        var service = new StaffService(
            database,
            new FixedTimeProvider(now));
        var professor = await service.CreateAsync(
            new CreateProfessorRequest($"Professor {Guid.NewGuid():N}", "0427"),
            cancellationToken);
        var invalid = await Assert.ThrowsAsync<UseCaseException>(
            () => service.StartAsync(
                new StartProfessorSessionRequest(professor.Id, "1111", 2, "tablet-test"),
                cancellationToken));
        var first = await service.StartAsync(
            new StartProfessorSessionRequest(professor.Id, "0427", 2, "tablet-test"),
            cancellationToken);
        var second = await service.StartAsync(
            new StartProfessorSessionRequest(professor.Id, "0427", 2, "tablet-test"),
            cancellationToken);
        var identityNumber = Guid.NewGuid().ToString("N");
        var attendanceMember = await new MemberService(database, new FixedTimeProvider(now)).CreateAsync(
            CreateRequest(identityNumber, "Class Attendance Member", MembershipPlan.Monthly, new DateOnly(2026, 7, 28)),
            cancellationToken);
        var classService = new ClassService(database, new FixedTimeProvider(now));
        var gymClass = await classService.CreateAsync(
            new CreateClassRequest(
                "Attendance Class", new DateOnly(2026, 7, 28), new TimeOnly(12, 0),
                60, 12, professor.Name, professor.Id, 2, null),
            cancellationToken);
        var attendance = await classService.RegisterAttendanceAsync(
            new RegisterClassAttendanceRequest(
                identityNumber, second.Id, "tablet-test", 2, gymClass.Id,
                new DateOnly(2026, 7, 28), new TimeOnly(12, 0)),
            cancellationToken);
        var duplicate = await Assert.ThrowsAsync<UseCaseException>(
            () => classService.RegisterAttendanceAsync(
                new RegisterClassAttendanceRequest(
                    identityNumber, second.Id, "tablet-test", 2, gymClass.Id,
                    new DateOnly(2026, 7, 28), new TimeOnly(12, 0)),
                cancellationToken));
        var detail = await classService.GetRecordDetailAsync(gymClass.Id, cancellationToken);
        var completedClassService = new ClassService(
            database,
            new FixedTimeProvider(now.AddMinutes(61)));
        var rated = await completedClassService.SetPerformanceRatingAsync(
            attendance.AttendanceId!.Value,
            new SetClassPerformanceRatingRequest(4, professor.Id, second.Id, "tablet-test"),
            cancellationToken);
        var history = await new MemberMobileHistoryService(database).GetAsync(
            attendanceMember.Member.Id, cancellationToken);
        var markedAbsent = await completedClassService.CorrectAttendanceAsync(
            gymClass.Id,
            new CorrectClassAttendanceRequest(
                identityNumber, false, professor.Id, "Correccion de prueba"),
            cancellationToken);
        var detailAfterAbsence = await completedClassService.GetRecordDetailAsync(
            gymClass.Id, cancellationToken);
        var markedPresentAgain = await completedClassService.CorrectAttendanceAsync(
            gymClass.Id,
            new CorrectClassAttendanceRequest(
                identityNumber, true, professor.Id, "Restauracion de prueba"),
            cancellationToken);
        var detailAfterRestore = await completedClassService.GetRecordDetailAsync(
            gymClass.Id, cancellationToken);
        var corrected = await completedClassService.SetHeldStatusAsync(
            gymClass.Id,
            new SetClassHeldStatusRequest(false),
            cancellationToken);
        var records = await completedClassService.ListRecordsAsync(
            new DateOnly(2026, 7, 28),
            cancellationToken);

        Assert.Equal("staff.invalid_pin", invalid.Code);
        Assert.NotEqual(first.Id, second.Id);
        Assert.Equal(second, await service.CurrentAsync("tablet-test", cancellationToken));
        Assert.True(attendance.Registered);
        Assert.NotNull(attendance.EntryId);
        Assert.Equal("class.attendance_duplicate", duplicate.Code);
        Assert.Single(detail.Students);
        Assert.True(detail.Students[0].Present);
        Assert.Equal("cancelada", corrected.Status);
        Assert.Contains(records, item => item.Id == gymClass.Id && item.Present == 1);
        Assert.Equal(4, rated.Score);
        Assert.Contains(history.Entries, item =>
            item.ClassId == gymClass.Id && item.PerformanceRating == 4);
        Assert.False(markedAbsent.Present);
        Assert.Empty(detailAfterAbsence.Students);
        Assert.True(markedPresentAgain.Present);
        Assert.Single(detailAfterRestore.Students);
        Assert.True(detailAfterRestore.Students[0].Present);
        Assert.NotEqual(attendance.AttendanceId, markedPresentAgain.AttendanceId);
        Assert.False((await database.ProfessorSessions.FindAsync([first.Id], cancellationToken))!.IsActive);
        await service.UpdateAsync(
            professor.Id,
            new UpdateProfessorRequest(null, null, false),
            cancellationToken);
        Assert.Null(await service.CurrentAsync("tablet-test", cancellationToken));
        await transaction.RollbackAsync(cancellationToken);
    }

    [Fact]
    public async Task ActiveProductSale_UpdatesSalesAndCashAtomically()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var database = CreateDatabase();
        await database.Database.MigrateAsync(ct);
        await using var transaction = await database.Database.BeginTransactionAsync(ct);
        var now = new DateTimeOffset(2026, 7, 28, 12, 0, 0, TimeSpan.Zero);
        var service = new InventoryService(database, new FixedTimeProvider(now));
        database.CashSessions.Add(CashSession.Open(
            new DateOnly(2026, 7, 28), "Integration Cashier", 500m, now));
        await database.SaveChangesAsync(ct);

        var product = await service.CreateProductAsync(
            new SaveProductRequest("Integration Water", 100m, true), ct);
        var sold = await service.SellProductAsync(
            product.Id,
            new SellProductRequest(
                product.Id, 3,
                new ProductPaymentRequest(300m, "efectivo", 300m, null)),
            ct);
        var sales = await service.ListSalesAsync(new DateOnly(2026, 7, 28), ct);

        Assert.True(sold.Success);
        Assert.Single(sales);
        Assert.Contains(database.CashMovements, x =>
            x.Type == CashMovementType.ProductSale && x.Amount == 300m);
        await transaction.RollbackAsync(ct);
    }

    private static UnderFitDbContext CreateDatabase()
    {
        var connectionString =
            Environment.GetEnvironmentVariable("UNDERFIT_TEST_CONNECTION_STRING")
            ?? DefaultConnectionString;
        var options = new DbContextOptionsBuilder<UnderFitDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new UnderFitDbContext(options);
    }

    private static CreateMemberRequest CreateRequest(
        string identityNumber,
        string name,
        MembershipPlan plan,
        DateOnly startsOn) =>
        new(
            identityNumber,
            name,
            plan,
            startsOn,
            "099123456",
            "member@example.com",
            "Integration details",
            "Emergency Contact",
            "098123456",
            true,
            new DateOnly(1990, 1, 1),
            "Integration Address",
            "Family",
            "None",
            "Strength",
            "efectivo",
            "efectivo");

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private sealed class FakeTokenIssuer : IMemberTokenIssuer
    {
        public IssuedMemberAccessToken Issue(
            Guid memberId,
            int sessionVersion,
            DateTimeOffset now) =>
            new("integration-access-token", now.AddMinutes(15));
    }
}
