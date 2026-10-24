using UnderFit.Domain.Common;

namespace UnderFit.Domain.Cash;

public sealed class CashMovement
{
    private CashMovement()
    {
    }

    private CashMovement(
        Guid cashSessionId,
        Guid? memberId,
        string? memberIdentityNumber,
        string? memberName,
        decimal amount,
        string paymentMethod,
        string description,
        DateTimeOffset occurredAtUtc,
        CashMovementType type,
        string? note = null,
        Guid? correctionOfId = null,
        string? correctionReason = null)
    {
        if (cashSessionId == Guid.Empty)
            throw new DomainException("A new cash movement requires a cash session.");
        if (amount == 0)
        {
            throw new DomainException("Cash movement amount cannot be zero.");
        }

        Id = Guid.NewGuid();
        CashSessionId = cashSessionId;
        MemberId = memberId;
        MemberIdentityNumber = memberIdentityNumber ?? string.Empty;
        MemberName = memberName ?? string.Empty;
        Amount = decimal.Round(amount, 2);
        PaymentMethod = paymentMethod;
        Description = description;
        OccurredAtUtc = occurredAtUtc;
        Type = type;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        CorrectionOfId = correctionOfId;
        CorrectionReason = string.IsNullOrWhiteSpace(correctionReason) ? null : correctionReason.Trim();
    }

    public Guid Id { get; private set; }
    // Only imported historical records may have no session. New operations
    // still require a session through every public factory.
    public Guid? CashSessionId { get; private set; }
    public bool IsLegacyUnassigned { get; private set; }
    public Guid? MemberId { get; private set; }
    public string MemberIdentityNumber { get; private set; } = string.Empty;
    public string MemberName { get; private set; } = string.Empty;
    public decimal Amount { get; private set; }
    public string PaymentMethod { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public DateTimeOffset OccurredAtUtc { get; private set; }
    public CashMovementType Type { get; private set; }
    public string? Note { get; private set; }
    public Guid? CorrectionOfId { get; private set; }
    public string? CorrectionReason { get; private set; }

    // Historical snapshot; deliberately independent of the editable product catalog.
    public int? ProductId { get; private set; }
    public string? ProductName { get; private set; }
    public int? ProductQuantity { get; private set; }

    public void SetProductSnapshot(int productId, string productName, int quantity)
    {
        if (Type != CashMovementType.ProductSale || productId <= 0 || quantity <= 0)
            throw new DomainException("Invalid product snapshot.");
        ProductId = productId;
        ProductName = productName;
        ProductQuantity = quantity;
    }

    public static CashMovement MembershipRenewal(
        Guid cashSessionId,
        Guid memberId,
        string memberIdentityNumber,
        string memberName,
        decimal amount,
        string paymentMethod,
        string description,
        DateTimeOffset occurredAtUtc) =>
        new(
            cashSessionId,
            memberId,
            memberIdentityNumber,
            memberName,
            amount,
            paymentMethod,
            description,
            occurredAtUtc,
            CashMovementType.MembershipRenewal);

    public static CashMovement Registration(
        Guid cashSessionId,
        Guid memberId,
        string memberIdentityNumber,
        string memberName,
        decimal amount,
        string paymentMethod,
        DateTimeOffset occurredAtUtc) =>
        new(
            cashSessionId,
            memberId,
            memberIdentityNumber,
            memberName,
            amount,
            paymentMethod,
            memberName,
            occurredAtUtc,
            CashMovementType.Registration);

    public static CashMovement Manual(
        Guid cashSessionId,
        CashMovementType type,
        decimal amount,
        string paymentMethod,
        string description,
        string? note,
        DateTimeOffset occurredAtUtc,
        Guid? correctionOfId = null,
        string? correctionReason = null) =>
        new(
            cashSessionId,
            null,
            null,
            null,
            amount,
            paymentMethod,
            description,
            occurredAtUtc,
            type,
            note,
            correctionOfId,
            correctionReason);

    public static CashMovement ProductSale(
        Guid cashSessionId,
        decimal amount,
        string paymentMethod,
        string description,
        string? note,
        DateTimeOffset occurredAtUtc,
        Guid? memberId = null,
        string? memberIdentityNumber = null,
        string? memberName = null) =>
        new(
            cashSessionId, memberId, memberIdentityNumber, memberName, amount, paymentMethod, description,
            occurredAtUtc, CashMovementType.ProductSale, note);
}

public enum CashMovementType
{
    MembershipRenewal,
    Registration,
    ManualIncome,
    CashOutput,
    ManualAdjustment,
    Cancellation,
    ProductSale
}
