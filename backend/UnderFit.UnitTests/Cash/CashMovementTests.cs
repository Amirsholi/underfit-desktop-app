using UnderFit.Domain.Cash;
using UnderFit.Domain.Common;
using Xunit;

namespace UnderFit.UnitTests.Cash;

public sealed class CashMovementTests
{
    [Fact]
    public void NewSaleRequiresRealSessionAndIsNeverLegacy()
    {
        Assert.Throws<DomainException>(() => CashMovement.ProductSale(
            Guid.Empty, 95m, "efectivo", "Agua", null, DateTimeOffset.UtcNow));
        var session = Guid.NewGuid();
        var movement = CashMovement.ProductSale(session, 95m, "efectivo", "Agua", null, DateTimeOffset.UtcNow);
        Assert.Equal(session, movement.CashSessionId);
        Assert.False(movement.IsLegacyUnassigned);
    }
}
