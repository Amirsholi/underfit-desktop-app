using UnderFit.Application.Abstractions;
using UnderFit.Application.Common;
using UnderFit.Contracts.Mobile;
using UnderFit.Domain.Members;

namespace UnderFit.Application.Mobile;

public sealed class MemberAccountDeletionService(
    IUnderFitDataStore dataStore,
    TimeProvider timeProvider)
{
    public async Task<MemberAccountDeletionRequestResponse> RequestAsync(
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var member = await dataStore.FindMemberByIdAsync(memberId, cancellationToken)
            ?? throw new UseCaseException("member.not_found", "No encontramos al socio.");
        var existing = await dataStore.FindPendingAccountDeletionRequestAsync(
            memberId,
            cancellationToken);
        if (existing is not null) return Map(existing);

        var account = await dataStore.FindMemberMobileAccountAsync(memberId, cancellationToken)
            ?? throw new UseCaseException(
                "mobile_auth.account_not_found",
                "La cuenta móvil ya no está activa.");
        var now = timeProvider.GetUtcNow();
        var request = new MemberAccountDeletionRequest(
            member.Id,
            member.IdentityNumber,
            member.Name,
            now);
        dataStore.AddAccountDeletionRequest(request);
        account.Deactivate();
        foreach (var token in await dataStore.ListUsableMemberRefreshTokensAsync(
                     memberId,
                     now,
                     cancellationToken))
        {
            token.Revoke(now);
        }
        await dataStore.SaveChangesAsync(cancellationToken);
        return Map(request);
    }

    public async Task<IReadOnlyList<MemberAccountDeletionRequestResponse>> ListAsync(
        bool pendingOnly,
        CancellationToken cancellationToken) =>
        (await dataStore.ListAccountDeletionRequestsAsync(pendingOnly, cancellationToken))
        .Select(Map)
        .ToArray();

    public async Task<MemberAccountDeletionRequestResponse> ResolveAsync(
        Guid requestId,
        ResolveMemberAccountDeletionRequest resolution,
        CancellationToken cancellationToken)
    {
        var request = await dataStore.FindAccountDeletionRequestAsync(
            requestId,
            cancellationToken)
            ?? throw new UseCaseException(
                "account_deletion.not_found",
                "No encontramos la solicitud.");
        request.Resolve(
            resolution.Completed,
            resolution.Note,
            timeProvider.GetUtcNow());
        await dataStore.SaveChangesAsync(cancellationToken);
        return Map(request);
    }

    private static MemberAccountDeletionRequestResponse Map(
        MemberAccountDeletionRequest request) =>
        new(
            request.Id,
            request.MemberIdentityNumber,
            request.MemberName,
            request.RequestedAtUtc,
            request.Status.ToString(),
            request.ResolvedAtUtc,
            request.ResolutionNote);
}
