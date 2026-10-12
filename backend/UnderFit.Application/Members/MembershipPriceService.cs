using UnderFit.Application.Abstractions;
using UnderFit.Contracts.Cash;
using UnderFit.Domain.Members;

namespace UnderFit.Application.Members;

public sealed class MembershipPriceService(IUnderFitDataStore dataStore)
{
    public async Task<MembershipPricesResponse> GetAsync(CancellationToken cancellationToken)
    {
        var prices = await dataStore.ListMembershipPricesAsync(cancellationToken);
        var registration = await dataStore.GetRegistrationPriceAsync(cancellationToken);
        return Map(prices, registration?.Amount ?? 0);
    }

    public async Task<MembershipPricesResponse> UpdateAsync(
        UpdateMembershipPricesRequest request,
        CancellationToken cancellationToken)
    {
        var prices = await dataStore.ListMembershipPricesAsync(cancellationToken);
        Set(prices, MembershipPlan.Monthly, request.Monthly);
        Set(prices, MembershipPlan.Quarterly, request.Quarterly);
        Set(prices, MembershipPlan.Semiannual, request.Semiannual);
        var registration = await dataStore.GetRegistrationPriceAsync(cancellationToken);
        if (registration is null)
        {
            dataStore.AddRegistrationPrice(new RegistrationPrice(request.Registration));
        }
        else
        {
            registration.ChangeAmount(request.Registration);
        }
        await dataStore.SaveChangesAsync(cancellationToken);
        return await GetAsync(cancellationToken);
    }

    private void Set(IReadOnlyList<MembershipPrice> prices, MembershipPlan plan, decimal amount)
    {
        var price = prices.SingleOrDefault(item => item.Plan == plan);
        if (price is null)
        {
            dataStore.AddMembershipPrice(new MembershipPrice(plan, amount));
        }
        else
        {
            price.ChangeAmount(amount);
        }
    }

    private static MembershipPricesResponse Map(
        IEnumerable<MembershipPrice> prices,
        decimal registration)
    {
        var values = prices.ToDictionary(price => price.Plan, price => price.Amount);
        return new(
            registration,
            values.GetValueOrDefault(MembershipPlan.Monthly),
            values.GetValueOrDefault(MembershipPlan.Quarterly),
            values.GetValueOrDefault(MembershipPlan.Semiannual));
    }
}
