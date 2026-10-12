namespace UnderFit.Contracts.Cash;

public sealed record OpenCashSessionRequest(
    DateOnly BusinessDate,
    string Cashier,
    decimal OpeningCash,
    string? Note = null);

public sealed record CashSessionResponse(
    Guid Id,
    DateOnly BusinessDate,
    string Cashier,
    decimal OpeningCash,
    DateTimeOffset OpenedAtUtc,
    string Status,
    string? Note);

public sealed record CloseCashSessionRequest(
    DateOnly BusinessDate,
    decimal? CountedCash,
    string? Note,
    string? ClosingCashier);

public sealed record CashClosureResponse(
    Guid Id,
    DateOnly BusinessDate,
    string OpeningCashier,
    decimal OpeningCash,
    DateTimeOffset OpenedAtUtc,
    string ClosingCashier,
    DateTimeOffset ClosedAtUtc,
    decimal TotalIncome,
    int MovementCount,
    decimal TotalCash,
    decimal TotalTransfer,
    decimal ExpectedCash,
    decimal CountedCash,
    decimal CashDifference,
    string? Note,
    string Status);

public sealed record CashMovementResponse(
    Guid Id,
    Guid? CashSessionId,
    DateOnly BusinessDate,
    string Type,
    string PaymentMethod,
    decimal Amount,
    string Description,
    string? Note,
    string? MemberIdentityNumber,
    string? MemberName,
    DateTimeOffset OccurredAtUtc,
    Guid? CorrectionOfId,
    string? CorrectionReason);

public sealed record CashTotalResponse(string Key, decimal Total);

public sealed record CashSummaryResponse(
    DateOnly BusinessDate,
    CashSessionResponse? Opening,
    CashClosureResponse? Closure,
    IReadOnlyList<CashMovementResponse> Movements,
    decimal TotalIncome,
    int MovementCount,
    IReadOnlyList<CashTotalResponse> TotalsByPaymentMethod,
    IReadOnlyList<CashTotalResponse> TotalsByType,
    decimal ExpectedCash,
    string Status);

public sealed record CreateManualCashMovementRequest(
    DateOnly BusinessDate,
    decimal Amount,
    string PaymentMethod,
    string? Note);

public sealed record AdjustCashTotalRequest(
    DateOnly BusinessDate,
    decimal NewTotal,
    string? Note);

public sealed record AdjustCashTotalResponse(
    bool Applied,
    decimal PreviousTotal,
    decimal NewTotal,
    decimal? Difference);

public sealed record CorrectCashMovementRequest(
    decimal Amount,
    string? PaymentMethod,
    string? Note,
    string Reason);

public sealed record CorrectCashMovementResponse(
    bool Corrected,
    Guid OriginalId,
    Guid ReplacementId);

public sealed record CashDailyReportResponse(
    DateOnly BusinessDate,
    IReadOnlyList<CashSummaryResponse> Sessions);

public sealed record MembershipPricesResponse(
    decimal Registration,
    decimal Monthly,
    decimal Quarterly,
    decimal Semiannual);

public sealed record UpdateMembershipPricesRequest(
    decimal Registration,
    decimal Monthly,
    decimal Quarterly,
    decimal Semiannual);
