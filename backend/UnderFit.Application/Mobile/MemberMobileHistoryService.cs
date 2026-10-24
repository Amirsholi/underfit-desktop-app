using UnderFit.Application.Abstractions;
using UnderFit.Contracts.Mobile;

namespace UnderFit.Application.Mobile;

public sealed class MemberMobileHistoryService(IUnderFitDataStore dataStore)
{
    public async Task<MemberMobileHistoryResponse> GetAsync(
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var entries = await dataStore.ListMemberEntriesAsync(memberId, cancellationToken);
        var renewals = await dataStore.ListMembershipRenewalsAsync(memberId, cancellationToken);
        var mappedEntries = new List<MemberMobileEntryResponse>(entries.Count);
        foreach (var item in entries)
        {
            var attendance = item.ClassId is null
                ? null
                : await dataStore.FindClassAttendanceAsync(
                    item.ClassId.Value, item.MemberIdentityNumber, cancellationToken);
            mappedEntries.Add(new MemberMobileEntryResponse(
                item.Id, item.OccurredAtUtc, item.Source, item.LocationId,
                item.LocationId == 1 ? "Recepción principal" : "Salón funcional",
                item.ClassId, item.Observation, attendance?.PerformanceRating,
                attendance?.RatedAtUtc));
        }
        return new(
            mappedEntries,
            renewals.Select(item => new MemberMobileRenewalResponse(
                item.Id, item.Plan.ToString(), item.PaidOn, item.Amount,
                item.PaymentMethod, item.NewExpiration)).ToArray());
    }
}
