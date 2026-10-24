namespace UnderFit.Domain.Inventory;

public sealed class ProductSale
{
    private ProductSale() { }

    public ProductSale(
        Product product, int quantity, decimal total, string paymentMethod,
        decimal receivedAmount, decimal change, string? note, DateTimeOffset occurredAtUtc)
    {
        Product = product;
        ProductName = product.Name;
        Quantity = quantity;
        Total = total;
        PaymentMethod = paymentMethod;
        ReceivedAmount = receivedAmount;
        Change = change;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        OccurredAtUtc = occurredAtUtc;
    }

    public int Id { get; private set; }
    public int ProductId { get; private set; }
    public Product Product { get; private set; } = null!;
    public string ProductName { get; private set; } = string.Empty;
    public int Quantity { get; private set; }
    public decimal Total { get; private set; }
    public string PaymentMethod { get; private set; } = string.Empty;
    public decimal ReceivedAmount { get; private set; }
    public decimal Change { get; private set; }
    public string? Note { get; private set; }
    public DateTimeOffset OccurredAtUtc { get; private set; }
}
