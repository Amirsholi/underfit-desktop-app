using UnderFit.Domain.Common;

namespace UnderFit.Domain.Cash;

public sealed class CashSession
{
    private CashSession()
    {
    }

    private CashSession(
        DateOnly businessDate,
        string cashier,
        decimal openingCash,
        DateTimeOffset openedAtUtc,
        string? openingNote)
    {
        if (string.IsNullOrWhiteSpace(cashier))
        {
            throw new DomainException("Cashier is required.");
        }
        if (openingCash < 0)
        {
            throw new DomainException("Opening cash cannot be negative.");
        }

        Id = Guid.NewGuid();
        BusinessDate = businessDate;
        Cashier = cashier.Trim();
        OpeningCash = decimal.Round(openingCash, 2);
        OpenedAtUtc = openedAtUtc;
        Status = CashSessionStatus.Open;
        OpeningNote = string.IsNullOrWhiteSpace(openingNote) ? null : openingNote.Trim();
    }

    public Guid Id { get; private set; }
    public DateOnly BusinessDate { get; private set; }
    public string Cashier { get; private set; } = string.Empty;
    public decimal OpeningCash { get; private set; }
    public DateTimeOffset OpenedAtUtc { get; private set; }
    public CashSessionStatus Status { get; private set; }
    public string? OpeningNote { get; private set; }
    public DateTimeOffset? ClosedAtUtc { get; private set; }
    public string? ClosingCashier { get; private set; }
    public decimal TotalIncome { get; private set; }
    public int MovementCount { get; private set; }
    public decimal TotalCash { get; private set; }
    public decimal TotalTransfer { get; private set; }
    public decimal ExpectedCash { get; private set; }
    public decimal CountedCash { get; private set; }
    public decimal CashDifference { get; private set; }
    public string? ClosingNote { get; private set; }

    public static CashSession Open(
        DateOnly businessDate,
        string cashier,
        decimal openingCash,
        DateTimeOffset openedAtUtc,
        string? openingNote = null) =>
        new(businessDate, cashier, openingCash, openedAtUtc, openingNote);

    public void Close(
        string closingCashier,
        decimal totalIncome,
        int movementCount,
        decimal totalCash,
        decimal totalTransfer,
        decimal expectedCash,
        decimal countedCash,
        string? note,
        DateTimeOffset closedAtUtc)
    {
        if (Status != CashSessionStatus.Open)
        {
            throw new DomainException("Cash session is already closed.");
        }
        if (string.IsNullOrWhiteSpace(closingCashier))
        {
            throw new DomainException("Closing cashier is required.");
        }
        if (countedCash < 0)
        {
            throw new DomainException("Counted cash cannot be negative.");
        }

        ClosingCashier = closingCashier.Trim();
        TotalIncome = decimal.Round(totalIncome, 2);
        MovementCount = movementCount;
        TotalCash = decimal.Round(totalCash, 2);
        TotalTransfer = decimal.Round(totalTransfer, 2);
        ExpectedCash = decimal.Round(expectedCash, 2);
        CountedCash = decimal.Round(countedCash, 2);
        CashDifference = decimal.Round(CountedCash - ExpectedCash, 2);
        ClosingNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        ClosedAtUtc = closedAtUtc;
        Status = CashSessionStatus.Closed;
    }
}

public enum CashSessionStatus
{
    Open,
    Closed
}
