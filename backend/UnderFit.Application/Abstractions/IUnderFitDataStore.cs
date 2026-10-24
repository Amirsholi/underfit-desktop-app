using UnderFit.Domain.Attendance;
using UnderFit.Domain.Cash;
using UnderFit.Domain.Members;
using UnderFit.Domain.Classes;
using UnderFit.Domain.Staff;
using UnderFit.Domain.Inventory;
using UnderFit.Domain.Settings;
using UnderFit.Domain.Training;

namespace UnderFit.Application.Abstractions;

public interface IUnderFitDataStore
{
    Task<bool> MemberIdentityExistsAsync(string identityNumber, CancellationToken cancellationToken);
    Task<Member?> FindMemberByIdentityAsync(string identityNumber, CancellationToken cancellationToken);
    Task<Member?> FindMemberByIdAsync(Guid memberId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Member>> ListMembersAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<MembershipRenewal>> ListMembershipRenewalsAsync(
        Guid memberId,
        CancellationToken cancellationToken);
    Task<decimal> GetMembershipPriceAsync(
        MembershipPlan plan,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<MembershipPrice>> ListMembershipPricesAsync(CancellationToken cancellationToken);
    Task<RegistrationPrice?> GetRegistrationPriceAsync(CancellationToken cancellationToken);
    Task<CashSession?> FindOpenCashSessionAsync(CancellationToken cancellationToken);
    Task<CashSession?> FindLatestCashSessionByDateAsync(
        DateOnly businessDate,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<CashSession>> ListCashSessionsByDateAsync(
        DateOnly businessDate,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<CashMovement>> ListCashMovementsAsync(
        Guid cashSessionId,
        CancellationToken cancellationToken);
    Task<CashMovement?> FindCashMovementAsync(Guid movementId, CancellationToken cancellationToken);
    Task<Entry?> FindEntryAsync(Guid entryId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Entry>> ListEntriesAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken,
        string? identityNumber = null);
    Task<IReadOnlyList<Entry>> ListMemberEntriesAsync(
        Guid memberId,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<GymClass>> ListClassesAsync(DateOnly from, CancellationToken cancellationToken);
    Task<IReadOnlyList<GymClass>> ListMemberEnrolledClassesAsync(
        Guid memberId,
        DateOnly from,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<ClassSchedule>> ListActiveClassSchedulesAsync(CancellationToken cancellationToken);
    Task<GymClass?> FindClassAsync(int classId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ClassEnrollment>> ListClassEnrollmentsAsync(
        int classId,
        int? scheduleId,
        DateOnly occurrenceDate,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<GymClass>> ListClassCandidatesAsync(int locationId, DateOnly date, CancellationToken cancellationToken);
    Task<bool> ClassAttendanceExistsAsync(int classId, string identityNumber, CancellationToken cancellationToken);
    Task<IReadOnlyList<GymClass>> ListClassesByDateAsync(DateOnly date, CancellationToken cancellationToken);
    Task<IReadOnlyList<ClassAttendance>> ListClassAttendancesAsync(int classId, CancellationToken cancellationToken);
    Task<ClassEnrollment?> FindActiveClassEnrollmentAsync(
        int classId,
        int? scheduleId,
        string identityNumber,
        CancellationToken cancellationToken);
    Task<ClassEnrollment?> FindActiveOccurrenceEnrollmentAsync(
        int classId, string identityNumber, CancellationToken cancellationToken);
    Task<ClassEnrollment?> FindActiveScheduleEnrollmentAsync(
        int scheduleId, string identityNumber, DateOnly occurrenceDate,
        CancellationToken cancellationToken);
    Task<ClassEnrollmentException?> FindClassEnrollmentExceptionAsync(
        int classId, string identityNumber, CancellationToken cancellationToken);
    Task<ClassAttendance?> FindClassAttendanceAsync(
        Guid attendanceId, CancellationToken cancellationToken);
    Task<ClassAttendance?> FindClassAttendanceAsync(
        int classId, string identityNumber, CancellationToken cancellationToken);
    Task<Professor?> FindProfessorAsync(int id, CancellationToken cancellationToken);
    Task<IReadOnlyList<Professor>> ListProfessorsAsync(bool includeInactive, CancellationToken cancellationToken);
    Task<ProfessorSession?> FindActiveProfessorSessionByDeviceAsync(string deviceId, CancellationToken cancellationToken);
    Task<ProfessorSession?> FindActiveProfessorSessionAsync(int id, CancellationToken cancellationToken);
    Task<IReadOnlyList<ProfessorSession>> ListActiveProfessorSessionsAsync(int professorId, CancellationToken cancellationToken);
    Task<IReadOnlyList<GymClass>> ListClassesInRangeAsync(DateOnly from, DateOnly through, CancellationToken cancellationToken);
    Task<bool> ClassOccurrenceExistsAsync(
        int scheduleId,
        DateOnly date,
        TimeOnly time,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<Product>> ListProductsAsync(CancellationToken cancellationToken);
    Task<Product?> FindProductAsync(int productId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ProductSale>> ListProductSalesAsync(DateOnly date, CancellationToken cancellationToken);
    Task<IReadOnlyList<PendingProductSale>> ListPendingProductSalesAsync(CancellationToken cancellationToken);
    Task<PendingProductSale?> FindPendingProductSaleAsync(int id, CancellationToken cancellationToken);
    Task<BusinessSettings?> GetBusinessSettingsAsync(CancellationToken cancellationToken);
    Task<MemberMobileAccount?> FindMemberMobileAccountAsync(
        Guid memberId,
        CancellationToken cancellationToken);
    Task<MemberRefreshToken?> FindMemberRefreshTokenAsync(
        byte[] tokenHash,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<MemberRefreshToken>> ListUsableMemberRefreshTokensAsync(
        Guid memberId,
        DateTimeOffset now,
        CancellationToken cancellationToken);
    Task<MemberAccountDeletionRequest?> FindPendingAccountDeletionRequestAsync(
        Guid memberId,
        CancellationToken cancellationToken);
    Task<MemberAccountDeletionRequest?> FindAccountDeletionRequestAsync(
        Guid requestId,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<MemberAccountDeletionRequest>> ListAccountDeletionRequestsAsync(
        bool pendingOnly,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<Exercise>> ListExercisesAsync(
        bool includeInactive,
        CancellationToken cancellationToken);
    Task<Exercise?> FindExerciseAsync(int exerciseId, CancellationToken cancellationToken);
    Task<WorkoutPlan?> FindActiveWorkoutPlanAsync(
        Guid memberId,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkoutPlan>> ListActiveWorkoutPlansAsync(
        CancellationToken cancellationToken);
    Task<IReadOnlyList<WorkoutTemplate>> ListWorkoutTemplatesAsync(
        CancellationToken cancellationToken);
    Task<WorkoutTemplate?> FindWorkoutTemplateAsync(
        int templateId,
        CancellationToken cancellationToken);
    void AddMember(Member member);
    void AddRenewal(MembershipRenewal renewal);
    void AddEntry(Entry entry);
    void AddCashSession(CashSession session);
    void AddCashMovement(CashMovement movement);
    void AddMembershipPrice(MembershipPrice price);
    void AddRegistrationPrice(RegistrationPrice price);
    void RemoveMember(Member member);
    void AddClass(GymClass gymClass);
    void AddClassSchedule(ClassSchedule schedule);
    void AddClassEnrollment(ClassEnrollment enrollment);
    void AddClassEnrollmentException(ClassEnrollmentException exception);
    void AddProfessor(Professor professor);
    void AddProfessorSession(ProfessorSession session);
    void AddClassAttendance(ClassAttendance attendance);
    void AddProduct(Product product);
    void RemoveProduct(Product product);
    void AddProductSale(ProductSale sale);
    void AddPendingProductSale(PendingProductSale sale);
    void AddBusinessSettings(BusinessSettings settings);
    void AddMemberMobileAccount(MemberMobileAccount account);
    void AddMemberRefreshToken(MemberRefreshToken token);
    void AddAccountDeletionRequest(MemberAccountDeletionRequest request);
    void AddExercise(Exercise exercise);
    void AddWorkoutPlan(WorkoutPlan plan);
    void AddWorkoutTemplate(WorkoutTemplate template);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
