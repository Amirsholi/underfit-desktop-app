using UnderFit.Application.Abstractions;
using UnderFit.Application.Common;
using UnderFit.Contracts.Members;
using UnderFit.Contracts.Cash;
using UnderFit.Domain.Cash;
using UnderFit.Domain.Members;

namespace UnderFit.Application.Members;

public sealed class MemberService(IUnderFitDataStore dataStore, TimeProvider timeProvider)
{
    public async Task<CreateMemberResponse> CreateAsync(
        CreateMemberRequest request,
        CancellationToken cancellationToken)
    {
        if (await dataStore.MemberIdentityExistsAsync(request.IdentityNumber.Trim(), cancellationToken))
        {
            throw new UseCaseException("member.identity_conflict", "A member with that identity number already exists.");
        }

        var member = Member.Create(
            request.IdentityNumber,
            request.Name,
            request.Plan,
            request.StartsOn,
            MapProfile(request));

        var registrationPrice = await dataStore.GetRegistrationPriceAsync(cancellationToken);
        CashMovement? movement = null;
        if (registrationPrice?.Amount > 0)
        {
            var session = await dataStore.FindOpenCashSessionAsync(cancellationToken)
                ?? throw new UseCaseException(
                    "cash.not_open",
                    "Cash must be opened before registering a paid member registration.");
            if (session.BusinessDate != request.StartsOn)
            {
                throw new UseCaseException(
                    "cash.business_date_mismatch",
                    "The open cash session does not match the member registration date.");
            }
            movement = CashMovement.Registration(
                session.Id,
                member.Id,
                member.IdentityNumber,
                member.Name,
                registrationPrice.Amount,
                NormalizePaymentMethod(request.RegistrationPaymentMethod ?? "efectivo"),
                timeProvider.GetUtcNow());
        }

        dataStore.AddMember(member);
        if (movement is not null)
        {
            dataStore.AddCashMovement(movement);
        }
        await dataStore.SaveChangesAsync(cancellationToken);
        return new(
            Map(member, Today()),
            movement is null ? null : MapCashMovement(movement, request.StartsOn));
    }

    public async Task<MemberResponse> GetByIdentityAsync(
        string identityNumber,
        CancellationToken cancellationToken)
    {
        var member = await dataStore.FindMemberByIdentityAsync(identityNumber.Trim(), cancellationToken)
            ?? throw new UseCaseException("member.not_found", "Member was not found.");

        return Map(member, Today());
    }

    public async Task<IReadOnlyList<MemberResponse>> ListAsync(CancellationToken cancellationToken)
    {
        var members = await dataStore.ListMembersAsync(cancellationToken);
        var today = Today();
        return members.Select(member => Map(member, today)).ToArray();
    }

    public async Task<DeleteMemberResponse> DeleteAsync(
        string identityNumber,
        CancellationToken cancellationToken)
    {
        var member = await dataStore.FindMemberByIdentityAsync(identityNumber.Trim(), cancellationToken);
        if (member is null)
        {
            return new(true, 0);
        }
        dataStore.RemoveMember(member);
        await dataStore.SaveChangesAsync(cancellationToken);
        return new(true, 1);
    }

    public async Task<RenewMembershipResponse> RenewAsync(
        Guid memberId,
        RenewMembershipRequest request,
        CancellationToken cancellationToken)
    {
        var member = await dataStore.FindMemberByIdAsync(memberId, cancellationToken)
            ?? throw new UseCaseException("member.not_found", "Member was not found.");
        return await RenewMemberAsync(member, request, cancellationToken);
    }

    public async Task<RenewMembershipResponse> RenewByIdentityAsync(
        string identityNumber,
        RenewMembershipRequest request,
        CancellationToken cancellationToken)
    {
        var member = await dataStore.FindMemberByIdentityAsync(identityNumber.Trim(), cancellationToken)
            ?? throw new UseCaseException("member.not_found", "Member was not found.");
        return await RenewMemberAsync(member, request, cancellationToken);
    }

    private async Task<RenewMembershipResponse> RenewMemberAsync(
        Member member,
        RenewMembershipRequest request,
        CancellationToken cancellationToken)
    {
        var paidAtUtc = timeProvider.GetUtcNow();
        var paymentMethod = NormalizePaymentMethod(request.PaymentMethod);
        var amount = await dataStore.GetMembershipPriceAsync(request.Plan, cancellationToken);
        CashMovement? movement = null;
        CashSession? session = null;
        if (amount > 0)
        {
            session = await dataStore.FindOpenCashSessionAsync(cancellationToken)
                ?? throw new UseCaseException(
                    "cash.not_open",
                    "Cash must be opened before registering a paid membership renewal.");
            if (session.BusinessDate != request.PaidOn)
            {
                throw new UseCaseException(
                    "cash.business_date_mismatch",
                    "The open cash session does not match the membership payment date.");
            }

            movement = CashMovement.MembershipRenewal(
                session.Id,
                member.Id,
                member.IdentityNumber,
                member.Name,
                amount,
                paymentMethod,
                $"{member.Name} - {request.Plan}",
                paidAtUtc);
            dataStore.AddCashMovement(movement);
        }

        var renewal = member.Renew(request.Plan, request.PaidOn, paidAtUtc) with
        {
            MemberName = member.Name,
            PaidAtUtc = paidAtUtc,
            Amount = amount,
            PaymentMethod = paymentMethod,
            CashSessionId = session?.Id,
            CashMovementId = movement?.Id
        };
        dataStore.AddRenewal(renewal);
        await dataStore.SaveChangesAsync(cancellationToken);
        return new RenewMembershipResponse(
            Map(member, Today()),
            MapRenewal(member.IdentityNumber, renewal));
    }

    public async Task<IReadOnlyList<MembershipRenewalResponse>> ListRenewalsAsync(
        string identityNumber,
        CancellationToken cancellationToken)
    {
        var member = await dataStore.FindMemberByIdentityAsync(identityNumber.Trim(), cancellationToken)
            ?? throw new UseCaseException("member.not_found", "Member was not found.");
        var renewals = await dataStore.ListMembershipRenewalsAsync(member.Id, cancellationToken);
        return renewals
            .Select(renewal => MapRenewal(member.IdentityNumber, renewal))
            .ToArray();
    }

    public async Task<MemberResponse> UpdateAsync(
        string identityNumber,
        UpdateMemberRequest request,
        CancellationToken cancellationToken)
    {
        var member = await dataStore.FindMemberByIdentityAsync(identityNumber.Trim(), cancellationToken)
            ?? throw new UseCaseException("member.not_found", "Member was not found.");

        var updatedAt = timeProvider.GetUtcNow();
        member.UpdateProfile(request.Name, MapProfile(request), updatedAt);
        member.UpdateMembershipManually(request.Plan, request.DaysRemaining, Today(), updatedAt);
        await dataStore.SaveChangesAsync(cancellationToken);
        return Map(member, Today());
    }

    private DateOnly Today() => DateOnly.FromDateTime(timeProvider.GetLocalNow().DateTime);

    private static MemberResponse Map(Member member, DateOnly today) =>
        new(
            member.Id,
            member.IdentityNumber,
            member.Name,
            member.Phone,
            member.Email,
            member.Details,
            member.EmergencyContactName,
            member.EmergencyContactPhone,
            member.ImageUseAuthorized,
            member.BirthDate,
            member.Address,
            member.EmergencyRelationship,
            member.MedicalCondition,
            member.Goal,
            member.RegistrationPaymentMethod,
            member.PaymentPreference,
            member.CurrentMembershipPlan,
            member.MembershipExpiresOn,
            member.CreatedAtUtc,
            member.UpdatedAtUtc,
            member.DaysRemainingOn(today));

    private static MemberProfile MapProfile(CreateMemberRequest request) =>
        new(
            request.Phone,
            request.Email,
            request.Details,
            request.EmergencyContactName,
            request.EmergencyContactPhone,
            request.ImageUseAuthorized,
            request.BirthDate,
            request.Address,
            request.EmergencyRelationship,
            request.MedicalCondition,
            request.Goal,
            request.RegistrationPaymentMethod,
            request.PaymentPreference);

    private static MemberProfile MapProfile(UpdateMemberRequest request) =>
        new(
            request.Phone,
            request.Email,
            request.Details,
            request.EmergencyContactName,
            request.EmergencyContactPhone,
            request.ImageUseAuthorized,
            request.BirthDate,
            request.Address,
            request.EmergencyRelationship,
            request.MedicalCondition,
            request.Goal,
            request.RegistrationPaymentMethod,
            request.PaymentPreference);

    private static MembershipRenewalResponse MapRenewal(
        string identityNumber,
        MembershipRenewal renewal) =>
        new(
            renewal.Id,
            renewal.MemberId,
            identityNumber,
            renewal.MemberName,
            renewal.Plan,
            (int)renewal.Plan,
            renewal.PaidOn,
            renewal.PaidAtUtc,
            renewal.Amount,
            renewal.PaymentMethod,
            renewal.PreviousExpiration,
            renewal.NewExpiration,
            renewal.CashSessionId,
            renewal.CashMovementId,
            renewal.Notes);

    private static CashMovementResponse MapCashMovement(
        CashMovement movement,
        DateOnly businessDate) =>
        new(
            movement.Id,
            movement.CashSessionId,
            businessDate,
            "alta",
            movement.PaymentMethod,
            movement.Amount,
            movement.Description,
            movement.Note,
            movement.MemberIdentityNumber,
            movement.MemberName,
            movement.OccurredAtUtc,
            movement.CorrectionOfId,
            movement.CorrectionReason);

    private static string NormalizePaymentMethod(string value)
    {
        var normalized = string.IsNullOrWhiteSpace(value)
            ? "efectivo"
            : value.Trim().ToLowerInvariant();
        if (normalized == "tarjeta")
        {
            normalized = "transferencia";
        }
        if (normalized is not ("efectivo" or "transferencia"))
        {
            throw new UseCaseException(
                "membership.invalid_payment_method",
                "Payment method must be cash or bank transfer.");
        }

        return normalized;
    }
}
