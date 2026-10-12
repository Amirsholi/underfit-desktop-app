using UnderFit.Domain.Common;

namespace UnderFit.Domain.Members;

public enum MembershipPlan
{
    Monthly = 30,
    Quarterly = 90,
    Semiannual = 180
}

public static class MembershipPlanExtensions
{
    public static DateOnly CalculateExpiration(this MembershipPlan plan, DateOnly startsOn) =>
        plan switch
        {
            MembershipPlan.Monthly => startsOn.AddDays(30),
            MembershipPlan.Quarterly => startsOn.AddDays(90),
            MembershipPlan.Semiannual => startsOn.AddDays(180),
            _ => throw new DomainException($"Unsupported membership plan: {plan}.")
        };
}
