using UnderFit.Domain.Common;
using UnderFit.Domain.Inventory;
using Xunit;

namespace UnderFit.UnitTests.Inventory;

public sealed class ProductTests
{
    [Fact]
    public void Product_CanBeActivatedOrDeactivated()
    {
        var product = new Product("Agua", 100m, true);

        product.Update("Agua", 100m, false);

        Assert.False(product.IsActive);
    }

    [Fact]
    public void Product_RejectsInvalidNameAndPrice()
    {
        var name = Assert.Throws<DomainException>(() => new Product("", 100m));
        var price = Assert.Throws<DomainException>(() => new Product("Agua", -1m));

        Assert.Equal("Nombre obligatorio", name.Message);
        Assert.Equal("Precio invalido", price.Message);
    }
}
