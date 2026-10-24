using UnderFit.Domain.Members;
using UnderFit.Contracts.Cash;

namespace UnderFit.Contracts.Members;

public sealed record CreateMemberRequest(
    string IdentityNumber,
    string Name,
    MembershipPlan Plan,
    DateOnly StartsOn,
    string? Phone,
    string? Email,
    string? Details,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    bool ImageUseAuthorized,
    DateOnly? BirthDate,
    string? Address,
    string? EmergencyRelationship,
    string? MedicalCondition,
    string? Goal,
    string? RegistrationPaymentMethod,
    string? PaymentPreference);

public sealed record UpdateMemberRequest(
    string Name,
    MembershipPlan Plan,
    int DaysRemaining,
    string? Phone,
    string? Email,
    string? Details,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    bool ImageUseAuthorized,
    DateOnly? BirthDate,
    string? Address,
    string? EmergencyRelationship,
    string? MedicalCondition,
    string? Goal,
    string? RegistrationPaymentMethod,
    string? PaymentPreference);

public sealed record RenewMembershipRequest(
    MembershipPlan Plan,
    DateOnly PaidOn,
    string PaymentMethod = "efectivo");

public sealed record MembershipRenewalResponse(
    Guid Id,
    Guid? MemberId,
    string MemberIdentityNumber,
    string MemberName,
    MembershipPlan Plan,
    int DaysAdded,
    DateOnly PaidOn,
    DateTimeOffset PaidAtUtc,
    decimal Amount,
    string PaymentMethod,
    DateOnly PreviousExpiration,
    DateOnly NewExpiration,
    Guid? CashSessionId,
    Guid? CashMovementId,
    string? Notes);

public sealed record RenewMembershipResponse(
    MemberResponse Member,
    MembershipRenewalResponse Renewal);

public sealed record CreateMemberResponse(
    MemberResponse Member,
    CashMovementResponse? CashMovement);

public sealed record DeleteMemberResponse(bool Success, int Changes);

public sealed record MemberResponse(
    Guid Id,
    string IdentityNumber,
    string Name,
    string? Phone,
    string? Email,
    string? Details,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    bool ImageUseAuthorized,
    DateOnly? BirthDate,
    string? Address,
    string? EmergencyRelationship,
    string? MedicalCondition,
    string? Goal,
    string? RegistrationPaymentMethod,
    string? PaymentPreference,
    MembershipPlan CurrentMembershipPlan,
    DateOnly MembershipExpiresOn,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    int DaysRemaining);
