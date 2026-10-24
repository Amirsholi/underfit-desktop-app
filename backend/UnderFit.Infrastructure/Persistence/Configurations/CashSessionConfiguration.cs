using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Cash;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class CashSessionConfiguration : IEntityTypeConfiguration<CashSession>
{
    public void Configure(EntityTypeBuilder<CashSession> builder)
    {
        builder.ToTable("cash_sessions");
        builder.HasKey(session => session.Id);
        builder.Property(session => session.BusinessDate).HasColumnType("date");
        builder.Property(session => session.Cashier).HasMaxLength(160);
        builder.Property(session => session.OpeningCash).HasPrecision(12, 2);
        builder.Property(session => session.OpeningNote).HasMaxLength(500);
        builder.Property(session => session.ClosingCashier).HasMaxLength(160);
        builder.Property(session => session.TotalIncome).HasPrecision(12, 2);
        builder.Property(session => session.TotalCash).HasPrecision(12, 2);
        builder.Property(session => session.TotalTransfer).HasPrecision(12, 2);
        builder.Property(session => session.ExpectedCash).HasPrecision(12, 2);
        builder.Property(session => session.CountedCash).HasPrecision(12, 2);
        builder.Property(session => session.CashDifference).HasPrecision(12, 2);
        builder.Property(session => session.ClosingNote).HasMaxLength(500);
        builder.Property(session => session.Status).HasConversion<string>().HasMaxLength(20);
        builder.HasIndex(session => session.BusinessDate);
        builder.HasIndex(session => session.Status)
            .IsUnique()
            .HasFilter("\"Status\" = 'Open'");
    }
}
