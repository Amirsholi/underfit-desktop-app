using UnderFit.Domain.Common;

namespace UnderFit.Domain.Members;

public sealed class MembershipPrice
{
    private MembershipPrice()
    {
    }

    public MembershipPrice(MembershipPlan plan, decimal amount)
    {
        if (amount < 0)
        {
            throw new DomainException("Membership price cannot be negative.");
        }

        Plan = plan;
        Amount = decimal.Round(amount, 2);
    }

    public MembershipPlan Plan { get; private set; }
    public decimal Amount { get; private set; }

    public void ChangeAmount(decimal amount)
    {
        if (amount < 0)
        {
            throw new DomainException("Membership price cannot be negative.");
        }

        Amount = decimal.Round(amount, 2);
    }
}
