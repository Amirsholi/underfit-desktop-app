namespace UnderFit.Contracts.Mobile;

public sealed record ConfigureMemberMobileAccessRequest(string Password);
public sealed record MemberMobileFirstUseRequest(string IdentityNumber, string Password);
public sealed record MemberMobileChangePasswordRequest(
    string CurrentPassword,
    string NewPassword);
public sealed record MemberMobileLoginRequest(string IdentityNumber, string Password);
public sealed record MemberMobileRefreshRequest(string RefreshToken);
public sealed record MemberMobileLogoutRequest(string RefreshToken);

public sealed record MemberMobileSessionResponse(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAtUtc,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAtUtc,
    MemberMobileProfileResponse Member);

public sealed record MemberMobileProfileResponse(
    string IdentityNumber,
    string Name,
    string? Email,
    string? Phone,
    string MembershipPlan,
    DateOnly MembershipExpiresOn,
    int DaysRemaining);
