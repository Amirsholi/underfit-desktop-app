using Microsoft.EntityFrameworkCore;
using UnderFit.Application.Abstractions;
using UnderFit.Domain.Attendance;
using UnderFit.Domain.Cash;
using UnderFit.Domain.Members;
using UnderFit.Domain.Classes;
using UnderFit.Domain.Staff;
using UnderFit.Domain.Inventory;
using UnderFit.Domain.Settings;
using UnderFit.Domain.Training;

namespace UnderFit.Infrastructure.Persistence;

public sealed class UnderFitDbContext(DbContextOptions<UnderFitDbContext> options)
    : DbContext(options), IUnderFitDataStore
{
    public DbSet<Member> Members => Set<Member>();
    public DbSet<MembershipRenewal> MembershipRenewals => Set<MembershipRenewal>();
    public DbSet<Entry> Entries => Set<Entry>();
    public DbSet<MembershipPrice> MembershipPrices => Set<MembershipPrice>();
    public DbSet<RegistrationPrice> RegistrationPrices => Set<RegistrationPrice>();
    public DbSet<CashSession> CashSessions => Set<CashSession>();
    public DbSet<CashMovement> CashMovements => Set<CashMovement>();
    public DbSet<GymClass> GymClasses => Set<GymClass>();
    public DbSet<ClassSchedule> ClassSchedules => Set<ClassSchedule>();
    public DbSet<ClassEnrollment> ClassEnrollments => Set<ClassEnrollment>();
    public DbSet<ClassEnrollmentException> ClassEnrollmentExceptions =>
        Set<ClassEnrollmentException>();
    public DbSet<Professor> Professors => Set<Professor>();
    public DbSet<ProfessorSession> ProfessorSessions => Set<ProfessorSession>();
    public DbSet<ClassAttendance> ClassAttendances => Set<ClassAttendance>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductSale> ProductSales => Set<ProductSale>();
    public DbSet<PendingProductSale> PendingProductSales => Set<PendingProductSale>();
    public DbSet<BusinessSettings> BusinessSettings => Set<BusinessSettings>();
    public DbSet<MemberMobileAccount> MemberMobileAccounts => Set<MemberMobileAccount>();
    public DbSet<MemberRefreshToken> MemberRefreshTokens => Set<MemberRefreshToken>();
    public DbSet<MemberAccountDeletionRequest> MemberAccountDeletionRequests =>
        Set<MemberAccountDeletionRequest>();
    public DbSet<Exercise> Exercises => Set<Exercise>();
    public DbSet<WorkoutPlan> WorkoutPlans => Set<WorkoutPlan>();
    public DbSet<WorkoutDay> WorkoutDays => Set<WorkoutDay>();
    public DbSet<WorkoutDayExercise> WorkoutDayExercises => Set<WorkoutDayExercise>();
    public DbSet<WorkoutTemplate> WorkoutTemplates => Set<WorkoutTemplate>();
    public DbSet<IdempotentRequest> IdempotentRequests => Set<IdempotentRequest>();

    public Task<bool> MemberIdentityExistsAsync(
        string identityNumber,
        CancellationToken cancellationToken) =>
        Members.AnyAsync(member => member.IdentityNumber == identityNumber, cancellationToken);

    public Task<Member?> FindMemberByIdentityAsync(
        string identityNumber,
        CancellationToken cancellationToken) =>
        Members.SingleOrDefaultAsync(member => member.IdentityNumber == identityNumber, cancellationToken);

    public Task<Member?> FindMemberByIdAsync(Guid memberId, CancellationToken cancellationToken) =>
        Members.SingleOrDefaultAsync(member => member.Id == memberId, cancellationToken);

    public Task<MemberAccountDeletionRequest?> FindPendingAccountDeletionRequestAsync(
        Guid memberId,
        CancellationToken cancellationToken) =>
        MemberAccountDeletionRequests.SingleOrDefaultAsync(
            item => item.MemberId == memberId &&
                item.Status == MemberAccountDeletionStatus.Pending,
            cancellationToken);

    public Task<MemberAccountDeletionRequest?> FindAccountDeletionRequestAsync(
        Guid requestId,
        CancellationToken cancellationToken) =>
        MemberAccountDeletionRequests.SingleOrDefaultAsync(
            item => item.Id == requestId,
            cancellationToken);

    public async Task<IReadOnlyList<MemberAccountDeletionRequest>> ListAccountDeletionRequestsAsync(
        bool pendingOnly,
        CancellationToken cancellationToken) =>
        await MemberAccountDeletionRequests
            .Where(item => !pendingOnly || item.Status == MemberAccountDeletionStatus.Pending)
            .OrderByDescending(item => item.RequestedAtUtc)
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<Member>> ListMembersAsync(CancellationToken cancellationToken) =>
        await Members.OrderBy(member => member.Name).ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<MembershipRenewal>> ListMembershipRenewalsAsync(
        Guid memberId,
        CancellationToken cancellationToken) =>
        await MembershipRenewals
            .Where(renewal => renewal.MemberId == memberId)
            .OrderByDescending(renewal => renewal.PaidAtUtc)
            .ToArrayAsync(cancellationToken);

    public Task<ClassEnrollment?> FindActiveClassEnrollmentAsync(
        int classId,
        int? scheduleId,
        string identityNumber,
        CancellationToken cancellationToken) =>
        ClassEnrollments.SingleOrDefaultAsync(
            item => item.IsActive &&
                item.MemberIdentityNumber == identityNumber &&
                (scheduleId == null ? item.ClassId == classId : item.ScheduleId == scheduleId),
            cancellationToken);
    public Task<ClassEnrollment?> FindActiveOccurrenceEnrollmentAsync(
        int classId, string identityNumber, CancellationToken cancellationToken) =>
        ClassEnrollments.SingleOrDefaultAsync(
            item => item.IsActive && item.ClassId == classId &&
                item.MemberIdentityNumber == identityNumber,
            cancellationToken);
    public Task<ClassEnrollment?> FindActiveScheduleEnrollmentAsync(
        int scheduleId, string identityNumber, DateOnly occurrenceDate,
        CancellationToken cancellationToken) =>
        ClassEnrollments.SingleOrDefaultAsync(
            item => item.IsActive && item.ScheduleId == scheduleId &&
                item.MemberIdentityNumber == identityNumber &&
                item.EffectiveFrom <= occurrenceDate &&
                (item.EffectiveUntil == null || item.EffectiveUntil >= occurrenceDate),
            cancellationToken);
    public Task<ClassEnrollmentException?> FindClassEnrollmentExceptionAsync(
        int classId, string identityNumber, CancellationToken cancellationToken) =>
        ClassEnrollmentExceptions.SingleOrDefaultAsync(
            item => item.ClassId == classId && item.MemberIdentityNumber == identityNumber,
            cancellationToken);
    public Task<ClassAttendance?> FindClassAttendanceAsync(
        Guid attendanceId, CancellationToken cancellationToken) =>
        ClassAttendances.SingleOrDefaultAsync(item => item.Id == attendanceId, cancellationToken);
    public Task<ClassAttendance?> FindClassAttendanceAsync(
        int classId, string identityNumber, CancellationToken cancellationToken) =>
        ClassAttendances.SingleOrDefaultAsync(
            item => item.ClassId == classId && item.MemberIdentityNumber == identityNumber &&
                !item.IsAnnulled,
            cancellationToken);
    public async Task<IReadOnlyList<GymClass>> ListClassCandidatesAsync(int locationId,DateOnly date,CancellationToken ct)=>await GymClasses.Where(x=>x.LocationId==locationId&&x.Date==date&&(x.Status==GymClassStatus.Scheduled||x.Status==GymClassStatus.InProgress)).OrderBy(x=>x.Time).ToArrayAsync(ct);
    public Task<bool> ClassAttendanceExistsAsync(int classId,string identity,CancellationToken ct)=>ClassAttendances.AnyAsync(x=>x.ClassId==classId&&x.MemberIdentityNumber==identity&&!x.IsAnnulled,ct);
    public async Task<IReadOnlyList<GymClass>> ListClassesByDateAsync(DateOnly date,CancellationToken ct)=>await GymClasses.Where(x=>x.Date==date).OrderBy(x=>x.Time).ThenBy(x=>x.Id).ToArrayAsync(ct);
    public async Task<IReadOnlyList<ClassAttendance>> ListClassAttendancesAsync(int id,CancellationToken ct)=>await ClassAttendances.Where(x=>x.ClassId==id&&!x.IsAnnulled).OrderBy(x=>x.OccurredAtUtc).ToArrayAsync(ct);
    public Task<Professor?> FindProfessorAsync(int id,CancellationToken ct)=>Professors.SingleOrDefaultAsync(x=>x.Id==id,ct);
    public async Task<IReadOnlyList<Professor>> ListProfessorsAsync(bool includeInactive,CancellationToken ct)=>await Professors.Where(x=>includeInactive||x.IsActive).OrderBy(x=>x.Name).ToArrayAsync(ct);
    public Task<ProfessorSession?> FindActiveProfessorSessionByDeviceAsync(string id,CancellationToken ct)=>ProfessorSessions.SingleOrDefaultAsync(x=>x.DeviceId==id&&x.IsActive,ct);
    public Task<ProfessorSession?> FindActiveProfessorSessionAsync(int id,CancellationToken ct)=>ProfessorSessions.SingleOrDefaultAsync(x=>x.Id==id&&x.IsActive,ct);
    public async Task<IReadOnlyList<ProfessorSession>> ListActiveProfessorSessionsAsync(int id,CancellationToken ct)=>await ProfessorSessions.Where(x=>x.ProfessorId==id&&x.IsActive).ToArrayAsync(ct);

    public async Task<decimal> GetMembershipPriceAsync(
        MembershipPlan plan,
        CancellationToken cancellationToken) =>
        await MembershipPrices
            .Where(price => price.Plan == plan)
            .Select(price => (decimal?)price.Amount)
            .SingleOrDefaultAsync(cancellationToken)
        ?? 0;

    public async Task<IReadOnlyList<MembershipPrice>> ListMembershipPricesAsync(
        CancellationToken cancellationToken) =>
        await MembershipPrices.OrderBy(price => price.Plan).ToArrayAsync(cancellationToken);

    public Task<RegistrationPrice?> GetRegistrationPriceAsync(CancellationToken cancellationToken) =>
        RegistrationPrices.SingleOrDefaultAsync(
            price => price.Id == RegistrationPrice.SingletonId,
            cancellationToken);

    public Task<CashSession?> FindOpenCashSessionAsync(CancellationToken cancellationToken) =>
        CashSessions.SingleOrDefaultAsync(
            session => session.Status == CashSessionStatus.Open,
            cancellationToken);

    public Task<CashSession?> FindLatestCashSessionByDateAsync(
        DateOnly businessDate,
        CancellationToken cancellationToken) =>
        CashSessions
            .Where(session => session.BusinessDate == businessDate)
            .OrderByDescending(session => session.OpenedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<CashSession>> ListCashSessionsByDateAsync(
        DateOnly businessDate,
        CancellationToken cancellationToken) =>
        await CashSessions
            .Where(session => session.BusinessDate == businessDate)
            .OrderBy(session => session.OpenedAtUtc)
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<CashMovement>> ListCashMovementsAsync(
        Guid cashSessionId,
        CancellationToken cancellationToken) =>
        await CashMovements
            .Where(movement => movement.CashSessionId == cashSessionId)
            .OrderBy(movement => movement.OccurredAtUtc)
            .ToArrayAsync(cancellationToken);

    public Task<CashMovement?> FindCashMovementAsync(
        Guid movementId,
        CancellationToken cancellationToken) =>
        CashMovements.SingleOrDefaultAsync(movement => movement.Id == movementId, cancellationToken);

    public Task<Entry?> FindEntryAsync(Guid entryId, CancellationToken cancellationToken) =>
        Entries.SingleOrDefaultAsync(entry => entry.Id == entryId, cancellationToken);

    public async Task<IReadOnlyList<Entry>> ListEntriesAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken,
        string? identityNumber = null)
    {
        var query = Entries.AsNoTracking().Where(entry => !entry.IsAnnulled);
        if (!string.IsNullOrWhiteSpace(identityNumber))
            query = query.Where(entry => entry.MemberIdentityNumber == identityNumber);
        if (from is not null)
        {
            var fromUtc = new DateTimeOffset(from.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            query = query.Where(entry => entry.OccurredAtUtc >= fromUtc);
        }
        if (to is not null)
        {
            var untilUtc = new DateTimeOffset(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            query = query.Where(entry => entry.OccurredAtUtc < untilUtc);
        }
        return await query.OrderByDescending(entry => entry.OccurredAtUtc).ToArrayAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Entry>> ListMemberEntriesAsync(
        Guid memberId,
        CancellationToken cancellationToken) =>
        await Entries
            .Where(entry => entry.MemberId == memberId && !entry.IsAnnulled)
            .OrderByDescending(entry => entry.OccurredAtUtc)
            .Take(100)
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<GymClass>> ListClassesAsync(
        DateOnly from,
        CancellationToken cancellationToken) =>
        await GymClasses
            .Where(item => item.Date >= from &&
                (item.Status == GymClassStatus.Scheduled || item.Status == GymClassStatus.InProgress))
            .OrderBy(item => item.Date).ThenBy(item => item.Time).ThenBy(item => item.Id)
            .Take(50)
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<GymClass>> ListMemberEnrolledClassesAsync(
        Guid memberId,
        DateOnly from,
        CancellationToken cancellationToken) =>
        await GymClasses
            .Where(gymClass =>
                gymClass.Date >= from &&
                (gymClass.Status == GymClassStatus.Scheduled ||
                 gymClass.Status == GymClassStatus.InProgress) &&
                ClassEnrollments.Any(enrollment =>
                    enrollment.MemberId == memberId &&
                    enrollment.EffectiveFrom <= gymClass.Date &&
                    (enrollment.EffectiveUntil == null ||
                     enrollment.EffectiveUntil >= gymClass.Date) &&
                    (enrollment.ClassId == gymClass.Id ||
                     (enrollment.ScheduleId != null &&
                      enrollment.ScheduleId == gymClass.ScheduleId &&
                      !ClassEnrollmentExceptions.Any(exception =>
                          exception.ClassId == gymClass.Id &&
                          exception.MemberId == memberId)))))
            .OrderBy(gymClass => gymClass.Date)
            .ThenBy(gymClass => gymClass.Time)
            .ThenBy(gymClass => gymClass.Id)
            .Take(50)
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<ClassSchedule>> ListActiveClassSchedulesAsync(
        CancellationToken cancellationToken) =>
        await ClassSchedules.Where(item => item.IsActive).ToArrayAsync(cancellationToken);

    public Task<GymClass?> FindClassAsync(int classId, CancellationToken cancellationToken) =>
        GymClasses.SingleOrDefaultAsync(item => item.Id == classId, cancellationToken);

    public async Task<IReadOnlyList<ClassEnrollment>> ListClassEnrollmentsAsync(
        int classId,
        int? scheduleId,
        DateOnly occurrenceDate,
        CancellationToken cancellationToken) =>
        await ClassEnrollments
            .Where(item =>
                (item.ClassId == classId ||
                 (scheduleId != null && item.ScheduleId == scheduleId &&
                  !ClassEnrollmentExceptions.Any(exception =>
                      exception.ClassId == classId &&
                      exception.MemberIdentityNumber == item.MemberIdentityNumber))) &&
                item.EffectiveFrom <= occurrenceDate &&
                (item.EffectiveUntil == null || item.EffectiveUntil >= occurrenceDate))
            .OrderBy(item => item.MemberName)
            .ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<GymClass>> ListClassesInRangeAsync(DateOnly from, DateOnly through, CancellationToken cancellationToken) =>
        await GymClasses.AsNoTracking().Where(item => item.Date >= from && item.Date <= through)
            .ToArrayAsync(cancellationToken);

    public Task<bool> ClassOccurrenceExistsAsync(
        int scheduleId,
        DateOnly date,
        TimeOnly time,
        CancellationToken cancellationToken) =>
        GymClasses.AnyAsync(
            item => item.ScheduleId == scheduleId && item.Date == date && item.Time == time,
            cancellationToken);

    public async Task<IReadOnlyList<Product>> ListProductsAsync(CancellationToken ct) =>
        await Products.OrderBy(x => x.Name).ThenBy(x => x.Id).ToArrayAsync(ct);
    public Task<Product?> FindProductAsync(int id, CancellationToken ct) =>
        Products.SingleOrDefaultAsync(x => x.Id == id, ct);
    public async Task<IReadOnlyList<ProductSale>> ListProductSalesAsync(DateOnly date, CancellationToken ct)
    {
        var from = new DateTimeOffset(date.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        var to = from.AddDays(1);
        return await ProductSales.Where(x => x.OccurredAtUtc >= from && x.OccurredAtUtc < to)
            .OrderByDescending(x => x.OccurredAtUtc).ThenByDescending(x => x.Id).ToArrayAsync(ct);
    }
    public async Task<IReadOnlyList<PendingProductSale>> ListPendingProductSalesAsync(CancellationToken ct) =>
        await PendingProductSales.OrderByDescending(x => x.OccurredAtUtc).ThenByDescending(x => x.Id)
            .ToArrayAsync(ct);
    public Task<PendingProductSale?> FindPendingProductSaleAsync(int id, CancellationToken ct) =>
        PendingProductSales.SingleOrDefaultAsync(x => x.Id == id, ct);
    public Task<BusinessSettings?> GetBusinessSettingsAsync(CancellationToken ct) =>
        BusinessSettings.SingleOrDefaultAsync(x => x.Id == UnderFit.Domain.Settings.BusinessSettings.SingletonId, ct);
    public Task<MemberMobileAccount?> FindMemberMobileAccountAsync(Guid memberId,CancellationToken ct) =>
        MemberMobileAccounts.SingleOrDefaultAsync(x=>x.MemberId==memberId,ct);
    public Task<MemberRefreshToken?> FindMemberRefreshTokenAsync(byte[] hash,CancellationToken ct) =>
        MemberRefreshTokens.Include(x=>x.Account).SingleOrDefaultAsync(x=>x.TokenHash==hash,ct);
    public async Task<IReadOnlyList<MemberRefreshToken>> ListUsableMemberRefreshTokensAsync(
        Guid memberId,DateTimeOffset now,CancellationToken ct) =>
        await MemberRefreshTokens.Where(x=>x.MemberId==memberId&&x.RevokedAtUtc==null&&x.ExpiresAtUtc>now)
            .ToArrayAsync(ct);
    public async Task<IReadOnlyList<Exercise>> ListExercisesAsync(bool includeInactive,CancellationToken ct) =>
        await Exercises.Where(x=>includeInactive||x.IsActive)
            .OrderBy(x=>x.MuscleGroup).ThenBy(x=>x.Name).ToArrayAsync(ct);
    public Task<Exercise?> FindExerciseAsync(int id,CancellationToken ct) =>
        Exercises.SingleOrDefaultAsync(x=>x.Id==id,ct);
    public Task<WorkoutPlan?> FindActiveWorkoutPlanAsync(Guid memberId,CancellationToken ct) =>
        WorkoutPlans
            .Include(x=>x.Professor)
            .Include(x=>x.Days).ThenInclude(x=>x.Exercises).ThenInclude(x=>x.Exercise)
            .SingleOrDefaultAsync(x=>x.MemberId==memberId&&x.IsActive,ct);
    public async Task<IReadOnlyList<WorkoutPlan>> ListActiveWorkoutPlansAsync(CancellationToken ct) =>
        await WorkoutPlans
            .Where(x => x.IsActive)
            .Include(x => x.Member)
            .Include(x => x.Professor)
            .Include(x => x.Days).ThenInclude(x => x.Exercises).ThenInclude(x => x.Exercise)
            .OrderBy(x => x.Member.Name)
            .ToArrayAsync(ct);
    public async Task<IReadOnlyList<WorkoutTemplate>> ListWorkoutTemplatesAsync(CancellationToken ct) =>
        await WorkoutTemplates.Where(x => x.IsActive).OrderBy(x => x.Name).ToArrayAsync(ct);
    public Task<WorkoutTemplate?> FindWorkoutTemplateAsync(int id,CancellationToken ct) =>
        WorkoutTemplates.SingleOrDefaultAsync(x => x.Id == id, ct);

    public void AddMember(Member member) => Members.Add(member);
    public void AddRenewal(MembershipRenewal renewal) => MembershipRenewals.Add(renewal);
    public void AddEntry(Entry entry) => Entries.Add(entry);
    public void AddCashSession(CashSession session) => CashSessions.Add(session);
    public void AddCashMovement(CashMovement movement) => CashMovements.Add(movement);
    public void AddMembershipPrice(MembershipPrice price) => MembershipPrices.Add(price);
    public void AddRegistrationPrice(RegistrationPrice price) => RegistrationPrices.Add(price);
    public void RemoveMember(Member member) => Members.Remove(member);
    public void AddClass(GymClass gymClass) => GymClasses.Add(gymClass);
    public void AddClassSchedule(ClassSchedule schedule) => ClassSchedules.Add(schedule);
    public void AddClassEnrollment(ClassEnrollment enrollment) => ClassEnrollments.Add(enrollment);
    public void AddClassEnrollmentException(ClassEnrollmentException exception) =>
        ClassEnrollmentExceptions.Add(exception);
    public void AddProfessor(Professor professor)=>Professors.Add(professor);
    public void AddProfessorSession(ProfessorSession session)=>ProfessorSessions.Add(session);
    public void AddClassAttendance(ClassAttendance attendance)=>ClassAttendances.Add(attendance);
    public void AddProduct(Product product) => Products.Add(product);
    public void RemoveProduct(Product product) => Products.Remove(product);
    public void AddProductSale(ProductSale sale) => ProductSales.Add(sale);
    public void AddPendingProductSale(PendingProductSale sale) => PendingProductSales.Add(sale);
    public void AddBusinessSettings(BusinessSettings settings) => BusinessSettings.Add(settings);
    public void AddMemberMobileAccount(MemberMobileAccount account) => MemberMobileAccounts.Add(account);
    public void AddMemberRefreshToken(MemberRefreshToken token) => MemberRefreshTokens.Add(token);
    public void AddAccountDeletionRequest(MemberAccountDeletionRequest request) =>
        MemberAccountDeletionRequests.Add(request);
    public void AddExercise(Exercise exercise) => Exercises.Add(exercise);
    public void AddWorkoutPlan(WorkoutPlan plan) => WorkoutPlans.Add(plan);
    public void AddWorkoutTemplate(WorkoutTemplate template) => WorkoutTemplates.Add(template);

    async Task IUnderFitDataStore.SaveChangesAsync(CancellationToken cancellationToken) =>
        await SaveChangesAsync(cancellationToken);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(UnderFitDbContext).Assembly);
    }
}
