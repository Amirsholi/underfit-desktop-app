using UnderFit.Domain.Common;

namespace UnderFit.Domain.Inventory;

public sealed class Product
{
    private Product() { }

    public Product(string name, decimal price, bool isActive = true)
    {
        SetDetails(name, price, isActive);
    }

    public int Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public decimal Price { get; private set; }
    public bool IsActive { get; private set; }
    public bool AvailableLocal1 { get; private set; } = true;
    public bool AvailableLocal2 { get; private set; } = true;

    public void SetLocations(bool? local1, bool? local2)
    {
        if (local1.HasValue) AvailableLocal1 = local1.Value;
        if (local2.HasValue) AvailableLocal2 = local2.Value;
    }

    public void Update(string name, decimal price, bool isActive) => SetDetails(name, price, isActive);

    private void SetDetails(string name, decimal price, bool isActive)
    {
        name = (name ?? string.Empty).Trim();
        if (name.Length == 0) throw new DomainException("Nombre obligatorio");
        if (price < 0) throw new DomainException("Precio invalido");
        Name = name;
        Price = price;
        IsActive = isActive;
    }
}
