using UnderFit.Domain.Common;

namespace UnderFit.Domain.Inventory;

public sealed class PendingProductSale
{
    private PendingProductSale() { }

    public PendingProductSale(
        Product product, string memberIdentityNumber, string memberName, int quantity,
        string professor, int professorId, int? professorSessionId, int locationId,
        string? note, DateTimeOffset occurredAtUtc)
    {
        if (quantity <= 0) throw new DomainException("Cantidad invalida");
        Product = product;
        ProductName = product.Name;
        MemberIdentityNumber = memberIdentityNumber;
        MemberName = memberName;
        Quantity = quantity;
        Total = product.Price * quantity;
        Professor = professor;
        ProfessorId = professorId;
        ProfessorSessionId = professorSessionId;
        LocationId = locationId;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        OccurredAtUtc = occurredAtUtc;
        Status = PendingProductSaleStatus.Pending;
    }

    public int Id { get; private set; }
    public int ProductId { get; private set; }
    public Product Product { get; private set; } = null!;
    public string ProductName { get; private set; } = string.Empty;
    public string MemberIdentityNumber { get; private set; } = string.Empty;
    public string MemberName { get; private set; } = string.Empty;
    public int Quantity { get; private set; }
    public decimal Total { get; private set; }
    public string Professor { get; private set; } = string.Empty;
    public int ProfessorId { get; private set; }
    public int? ProfessorSessionId { get; private set; }
    public int LocationId { get; private set; }
    public string? Note { get; private set; }
    public DateTimeOffset OccurredAtUtc { get; private set; }
    public PendingProductSaleStatus Status { get; private set; }
    public DateTimeOffset? CollectedAtUtc { get; private set; }
    public string? PaymentMethod { get; private set; }
    public Guid? CashMovementId { get; private set; }

    public void Collect(string paymentMethod, Guid cashMovementId, DateTimeOffset at)
    {
        if (Status != PendingProductSaleStatus.Pending)
            throw new DomainException("El cobro ya no esta pendiente");
        Status = PendingProductSaleStatus.Collected;
        PaymentMethod = paymentMethod;
        CashMovementId = cashMovementId;
        CollectedAtUtc = at;
    }
}

public enum PendingProductSaleStatus
{
    Pending,
    Collected
}
