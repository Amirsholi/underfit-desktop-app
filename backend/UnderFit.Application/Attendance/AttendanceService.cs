using UnderFit.Application.Abstractions;
using UnderFit.Application.Common;
using UnderFit.Contracts.Attendance;
using UnderFit.Domain.Attendance;

namespace UnderFit.Application.Attendance;

public sealed class AttendanceService(IUnderFitDataStore dataStore, TimeProvider timeProvider)
{
    public async Task<EntryResponse> RegisterAsync(
        RegisterEntryRequest request,
        CancellationToken cancellationToken)
    {
        var member = await dataStore.FindMemberByIdentityAsync(request.IdentityNumber.Trim(), cancellationToken)
            ?? throw new UseCaseException("access.member_not_found", "Member was not found.");

        var occurredAt = request.OccurredAtUtc ?? timeProvider.GetUtcNow();
        var localDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(occurredAt, timeProvider.LocalTimeZone).DateTime);
        if (!member.CanEnterOn(localDate))
        {
            throw new UseCaseException("access.membership_expired", "Membership is expired.");
        }

        var entry = Entry.Register(
            member.Id,
            member.IdentityNumber,
            member.Name,
            occurredAt,
            request.Source,
            request.Observation,
            request.LocationId,
            request.DeviceId,
            request.ClassId);
        dataStore.AddEntry(entry);
        await dataStore.SaveChangesAsync(cancellationToken);

        return new EntryResponse(
            entry.Id,
            member.Id,
            member.Name,
            member.MembershipExpiresOn,
            member.DaysRemainingOn(localDate),
            occurredAt);
    }

    public async Task<IReadOnlyList<EntryListItemResponse>> ListAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken,
        string? identityNumber = null)
    {
        // The store filters UTC dates; retain a one-day margin for local offsets,
        // then apply the exact local-day filter below without loading all history.
        var entries = await dataStore.ListEntriesAsync(
            from is null || from == DateOnly.MinValue ? from : from.Value.AddDays(-1),
            to is null || to == DateOnly.MaxValue ? null : to.Value.AddDays(1), cancellationToken, identityNumber);
        return entries
            .Select(entry =>
            {
                var local = TimeZoneInfo.ConvertTime(entry.OccurredAtUtc, timeProvider.LocalTimeZone);
                return new { Entry = entry, Local = local };
            })
            .Where(item =>
            {
                var date = DateOnly.FromDateTime(item.Local.DateTime);
                return (from is null || date >= from) && (to is null || date <= to);
            })
            .Select(item => new EntryListItemResponse(
                item.Entry.Id,
                DateOnly.FromDateTime(item.Local.DateTime),
                TimeOnly.FromDateTime(item.Local.DateTime),
                item.Entry.MemberIdentityNumber,
                item.Entry.MemberName,
                item.Entry.Source,
                item.Entry.Observation,
                item.Entry.LocationId,
                item.Entry.DeviceId,
                item.Entry.ClassId))
            .ToArray();
    }

    public async Task<AnnulEntryResponse> AnnulAsync(
        Guid entryId,
        AnnulEntryRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new UseCaseException(
                "entry.annulment_reason_required",
                "The annulment reason is required.");
        }
        var entry = await dataStore.FindEntryAsync(entryId, cancellationToken);
        if (entry is null || entry.IsAnnulled)
        {
            throw new UseCaseException("entry.not_found", "Entry was not found.");
        }
        var now = timeProvider.GetUtcNow();
        var today = DateOnly.FromDateTime(timeProvider.GetLocalNow().DateTime);
        var entryDate = DateOnly.FromDateTime(
            TimeZoneInfo.ConvertTime(entry.OccurredAtUtc, timeProvider.LocalTimeZone).DateTime);
        if (entryDate != today)
        {
            throw new UseCaseException(
                "entry.not_today",
                "Only entries from the current day can be annulled.");
        }
        entry.Annul(request.Reason, now);
        await dataStore.SaveChangesAsync(cancellationToken);
        return new(true, entry.Id);
    }
}
