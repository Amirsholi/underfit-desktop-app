using UnderFit.Application.Abstractions;
using UnderFit.Application.Common;
using UnderFit.Contracts.Cash;
using UnderFit.Domain.Cash;

namespace UnderFit.Application.Cash;

public sealed class CashSessionService(IUnderFitDataStore dataStore, TimeProvider timeProvider)
{
    public async Task<CashSessionResponse?> GetCurrentAsync(CancellationToken cancellationToken)
    {
        var session = await dataStore.FindOpenCashSessionAsync(cancellationToken);
        return session is null ? null : Map(session);
    }

    public async Task<CashClosureResponse> CloseAsync(
        CloseCashSessionRequest request,
        CancellationToken cancellationToken)
    {
        var session = await dataStore.FindOpenCashSessionAsync(cancellationToken)
            ?? throw new UseCaseException("cash.not_open", "Cash must be open before it can be closed.");
        if (session.BusinessDate != request.BusinessDate)
        {
            throw new UseCaseException(
                "cash.business_date_mismatch",
                "The open cash session does not match the closing date.");
        }

        var movements = await dataStore.ListCashMovementsAsync(session.Id, cancellationToken);
        var totalIncome = movements.Sum(movement => movement.Amount);
        var totalCash = movements
            .Where(movement => movement.PaymentMethod == "efectivo")
            .Sum(movement => movement.Amount);
        var totalTransfer = movements
            .Where(movement => movement.PaymentMethod == "transferencia")
            .Sum(movement => movement.Amount);
        var expectedCash = session.OpeningCash + totalCash;
        var countedCash = request.CountedCash ?? expectedCash;
        var closingCashier = string.IsNullOrWhiteSpace(request.ClosingCashier)
            ? session.Cashier
            : request.ClosingCashier;

        session.Close(
            closingCashier!,
            totalIncome,
            movements.Count,
            totalCash,
            totalTransfer,
            expectedCash,
            countedCash,
            request.Note,
            timeProvider.GetUtcNow());
        await dataStore.SaveChangesAsync(cancellationToken);
        return MapClosure(session);
    }

    public async Task<CashClosureResponse?> GetClosureAsync(
        DateOnly businessDate,
        CancellationToken cancellationToken)
    {
        var session = await dataStore.FindLatestCashSessionByDateAsync(businessDate, cancellationToken);
        return session?.Status == CashSessionStatus.Closed ? MapClosure(session) : null;
    }

    public async Task<CashSummaryResponse> GetSummaryAsync(
        DateOnly businessDate,
        CancellationToken cancellationToken)
    {
        var session = await dataStore.FindLatestCashSessionByDateAsync(businessDate, cancellationToken);
        if (session is null)
        {
            return new(
                businessDate, null, null, [], 0, 0, [], [], 0, "sin_apertura");
        }

        var movements = await dataStore.ListCashMovementsAsync(session.Id, cancellationToken);
        var totalIncome = movements.Sum(movement => movement.Amount);
        var totalsByPayment = movements
            .GroupBy(movement => movement.PaymentMethod)
            .Select(group => new CashTotalResponse(group.Key, group.Sum(item => item.Amount)))
            .OrderBy(item => item.Key)
            .ToArray();
        var totalsByType = movements
            .GroupBy(movement => MapMovementType(movement.Type))
            .Select(group => new CashTotalResponse(group.Key, group.Sum(item => item.Amount)))
            .OrderBy(item => item.Key)
            .ToArray();
        var expectedCash = session.Status == CashSessionStatus.Closed
            ? session.ExpectedCash
            : session.OpeningCash + movements
                .Where(movement => movement.PaymentMethod == "efectivo")
                .Sum(movement => movement.Amount);

        return new(
            businessDate,
            Map(session),
            session.Status == CashSessionStatus.Closed ? MapClosure(session) : null,
            movements.Select(movement => MapMovement(movement, businessDate)).ToArray(),
            totalIncome,
            movements.Count,
            totalsByPayment,
            totalsByType,
            expectedCash,
            session.Status == CashSessionStatus.Open ? "abierta" : "cerrada");
    }

    public async Task<CashDailyReportResponse> GetDailyReportAsync(
        DateOnly businessDate,
        CancellationToken cancellationToken)
    {
        var sessions = await dataStore.ListCashSessionsByDateAsync(businessDate, cancellationToken);
        var summaries = new List<CashSummaryResponse>(sessions.Count);
        foreach (var session in sessions)
        {
            var movements = await dataStore.ListCashMovementsAsync(session.Id, cancellationToken);
            var totalIncome = movements.Sum(movement => movement.Amount);
            var totalsByPayment = movements
                .GroupBy(movement => movement.PaymentMethod)
                .Select(group => new CashTotalResponse(group.Key, group.Sum(item => item.Amount)))
                .OrderBy(item => item.Key)
                .ToArray();
            var totalsByType = movements
                .GroupBy(movement => MapMovementType(movement.Type))
                .Select(group => new CashTotalResponse(group.Key, group.Sum(item => item.Amount)))
                .OrderBy(item => item.Key)
                .ToArray();
            var expectedCash = session.Status == CashSessionStatus.Closed
                ? session.ExpectedCash
                : session.OpeningCash + movements
                    .Where(movement => movement.PaymentMethod == "efectivo")
                    .Sum(movement => movement.Amount);
            summaries.Add(new(
                businessDate,
                Map(session),
                session.Status == CashSessionStatus.Closed ? MapClosure(session) : null,
                movements.Select(movement => MapMovement(movement, businessDate)).ToArray(),
                totalIncome,
                movements.Count,
                totalsByPayment,
                totalsByType,
                expectedCash,
                session.Status == CashSessionStatus.Open ? "abierta" : "cerrada"));
        }

        return new(businessDate, summaries);
    }

    public Task<CashMovementResponse> RegisterManualIncomeAsync(
        CreateManualCashMovementRequest request,
        CancellationToken cancellationToken) =>
        RegisterManualMovementAsync(request, CashMovementType.ManualIncome, false, cancellationToken);

    public Task<CashMovementResponse> RegisterCashOutputAsync(
        CreateManualCashMovementRequest request,
        CancellationToken cancellationToken) =>
        RegisterManualMovementAsync(request, CashMovementType.CashOutput, true, cancellationToken);

    public async Task<AdjustCashTotalResponse> AdjustTotalAsync(
        AdjustCashTotalRequest request,
        CancellationToken cancellationToken)
    {
        if (request.NewTotal < 0)
        {
            throw new UseCaseException("cash.invalid_total", "Cash total cannot be negative.");
        }

        var session = await RequireOpenSessionAsync(request.BusinessDate, cancellationToken);
        var movements = await dataStore.ListCashMovementsAsync(session.Id, cancellationToken);
        var currentTotal = movements.Sum(movement => movement.Amount);
        var difference = decimal.Round(request.NewTotal - currentTotal, 2);
        if (difference == 0)
        {
            return new(false, currentTotal, currentTotal, null);
        }

        dataStore.AddCashMovement(CashMovement.Manual(
            session.Id,
            CashMovementType.ManualAdjustment,
            difference,
            "ajuste",
            "Ajuste manual de total diario",
            request.Note,
            timeProvider.GetUtcNow()));
        await dataStore.SaveChangesAsync(cancellationToken);
        return new(true, currentTotal, request.NewTotal, difference);
    }

    public async Task<CorrectCashMovementResponse> CorrectMovementAsync(
        Guid movementId,
        CorrectCashMovementRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Amount <= 0)
        {
            throw new UseCaseException("cash.invalid_amount", "Amount must be greater than zero.");
        }
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new UseCaseException("cash.correction_reason_required", "Correction reason is required.");
        }

        var original = await dataStore.FindCashMovementAsync(movementId, cancellationToken)
            ?? throw new UseCaseException("cash.movement_not_found", "Cash movement was not found.");
        if (original.Type is not (CashMovementType.ManualIncome or CashMovementType.CashOutput))
        {
            throw new UseCaseException(
                "cash.movement_not_correctable",
                "Only manual income and cash outputs can be corrected.");
        }

        var session = await dataStore.FindOpenCashSessionAsync(cancellationToken)
            ?? throw new UseCaseException("cash.not_open", "Cash must be open before registering movements.");
        if (session.Id != original.CashSessionId)
        {
            throw new UseCaseException(
                "cash.movement_not_in_open_session",
                "Only movements from the open cash session can be corrected.");
        }

        var paymentMethod = NormalizePaymentMethod(request.PaymentMethod ?? original.PaymentMethod);
        var occurredAt = timeProvider.GetUtcNow();
        var cancellation = CashMovement.Manual(
            session.Id,
            CashMovementType.Cancellation,
            -original.Amount,
            original.PaymentMethod,
            $"Anulacion de movimiento #{original.Id}",
            request.Reason,
            occurredAt,
            original.Id,
            request.Reason);
        var replacementAmount = original.Type == CashMovementType.CashOutput
            ? -request.Amount
            : request.Amount;
        var replacement = CashMovement.Manual(
            session.Id,
            original.Type,
            replacementAmount,
            paymentMethod,
            string.IsNullOrWhiteSpace(request.Note) ? original.Description : request.Note,
            request.Note,
            occurredAt,
            original.Id,
            request.Reason);
        dataStore.AddCashMovement(cancellation);
        dataStore.AddCashMovement(replacement);
        await dataStore.SaveChangesAsync(cancellationToken);
        return new(true, original.Id, replacement.Id);
    }

    private async Task<CashMovementResponse> RegisterManualMovementAsync(
        CreateManualCashMovementRequest request,
        CashMovementType type,
        bool negative,
        CancellationToken cancellationToken)
    {
        if (request.Amount <= 0)
        {
            throw new UseCaseException("cash.invalid_amount", "Amount must be greater than zero.");
        }

        var session = await RequireOpenSessionAsync(request.BusinessDate, cancellationToken);
        var paymentMethod = NormalizePaymentMethod(request.PaymentMethod);
        var description = string.IsNullOrWhiteSpace(request.Note)
            ? type == CashMovementType.CashOutput ? "Egreso" : "Ingreso manual"
            : request.Note;
        var movement = CashMovement.Manual(
            session.Id,
            type,
            negative ? -request.Amount : request.Amount,
            paymentMethod,
            description!,
            request.Note,
            timeProvider.GetUtcNow());
        dataStore.AddCashMovement(movement);
        await dataStore.SaveChangesAsync(cancellationToken);
        return MapMovement(movement, request.BusinessDate);
    }

    private async Task<CashSession> RequireOpenSessionAsync(
        DateOnly businessDate,
        CancellationToken cancellationToken)
    {
        var session = await dataStore.FindOpenCashSessionAsync(cancellationToken)
            ?? throw new UseCaseException("cash.not_open", "Cash must be open before registering movements.");
        if (session.BusinessDate != businessDate)
        {
            throw new UseCaseException(
                "cash.business_date_mismatch",
                "The open cash session does not match the movement date.");
        }
        return session;
    }

    private static string NormalizePaymentMethod(string? value)
    {
        var normalized = (value ?? "efectivo").Trim().ToLowerInvariant();
        if (normalized == "tarjeta")
        {
            normalized = "transferencia";
        }
        if (normalized is not ("efectivo" or "transferencia"))
        {
            throw new UseCaseException("cash.payment_method_required", "Payment method is required.");
        }
        return normalized;
    }

    public async Task<CashSessionResponse> OpenAsync(
        OpenCashSessionRequest request,
        CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(timeProvider.GetLocalNow().DateTime);
        if (request.BusinessDate != today)
        {
            throw new UseCaseException(
                "cash.invalid_business_date",
                "Cash can only be opened for the current local date.");
        }

        if (await dataStore.FindOpenCashSessionAsync(cancellationToken) is not null)
        {
            throw new UseCaseException("cash.already_open", "A cash session is already open.");
        }

        var session = CashSession.Open(
            request.BusinessDate,
            request.Cashier,
            request.OpeningCash,
            timeProvider.GetUtcNow(),
            request.Note);
        dataStore.AddCashSession(session);
        await dataStore.SaveChangesAsync(cancellationToken);
        return Map(session);
    }

    private static CashSessionResponse Map(CashSession session) =>
        new(
            session.Id,
            session.BusinessDate,
            session.Cashier,
            session.OpeningCash,
            session.OpenedAtUtc,
            session.Status.ToString().ToLowerInvariant(),
            session.OpeningNote);

    private static CashClosureResponse MapClosure(CashSession session) =>
        new(
            session.Id,
            session.BusinessDate,
            session.Cashier,
            session.OpeningCash,
            session.OpenedAtUtc,
            session.ClosingCashier!,
            session.ClosedAtUtc!.Value,
            session.TotalIncome,
            session.MovementCount,
            session.TotalCash,
            session.TotalTransfer,
            session.ExpectedCash,
            session.CountedCash,
            session.CashDifference,
            session.ClosingNote,
            session.Status.ToString().ToLowerInvariant());

    private static CashMovementResponse MapMovement(CashMovement movement, DateOnly businessDate) =>
        new(
            movement.Id,
            movement.CashSessionId,
            businessDate,
            MapMovementType(movement.Type),
            movement.PaymentMethod,
            movement.Amount,
            movement.Description,
            movement.Note,
            movement.MemberIdentityNumber,
            movement.MemberName,
            movement.OccurredAtUtc,
            movement.CorrectionOfId,
            movement.CorrectionReason,
            movement.ProductId,
            movement.ProductName,
            movement.ProductQuantity);

    private static string MapMovementType(CashMovementType type) =>
        type switch
        {
            CashMovementType.MembershipRenewal => "renovacion",
            CashMovementType.ManualIncome => "ingreso_manual",
            CashMovementType.CashOutput => "egreso",
            CashMovementType.ManualAdjustment => "ajuste_manual",
            CashMovementType.Cancellation => "anulacion",
            _ => type.ToString().ToLowerInvariant()
        };
}
