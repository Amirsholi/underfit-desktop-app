using UnderFit.Domain.Common;

namespace UnderFit.Domain.Members;

public sealed class RegistrationPrice
{
    public const int SingletonId = 1;

    private RegistrationPrice()
    {
    }

    public RegistrationPrice(decimal amount)
    {
        Id = SingletonId;
        ChangeAmount(amount);
    }

    public int Id { get; private set; }
    public decimal Amount { get; private set; }

    public void ChangeAmount(decimal amount)
    {
        if (amount < 0)
        {
            throw new DomainException("Registration price cannot be negative.");
        }
        Amount = decimal.Round(amount, 2);
    }
}
