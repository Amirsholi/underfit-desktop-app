namespace UnderFit.Domain.Members;

public sealed record MemberProfile(
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
