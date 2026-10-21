using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Cash;
using UnderFit.Domain.Members;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class CashMovementConfiguration : IEntityTypeConfiguration<CashMovement>
{
    public void Configure(EntityTypeBuilder<CashMovement> builder)
    {
        builder.ToTable("cash_movements", table => table.HasCheckConstraint(
            "CK_cash_movements_legacy_session",
            "(\"CashSessionId\" IS NULL) = \"IsLegacyUnassigned\""));
        builder.Property(movement => movement.IsLegacyUnassigned).HasDefaultValue(false);
        builder.Property(movement => movement.ProductName).HasMaxLength(300);
        builder.HasKey(movement => movement.Id);
        builder.Property(movement => movement.MemberIdentityNumber).HasMaxLength(32);
        builder.Property(movement => movement.MemberName).HasMaxLength(160);
        builder.Property(movement => movement.Amount).HasPrecision(12, 2);
        builder.Property(movement => movement.PaymentMethod).HasMaxLength(40);
        builder.Property(movement => movement.Description).HasMaxLength(300);
        builder.Property(movement => movement.Note).HasMaxLength(500);
        builder.Property(movement => movement.CorrectionReason).HasMaxLength(500);
        builder.Property(movement => movement.Type).HasConversion<string>().HasMaxLength(40);
        builder.HasIndex(movement => new { movement.CashSessionId, movement.OccurredAtUtc });
        builder.HasOne<CashSession>()
            .WithMany()
            .HasForeignKey(movement => movement.CashSessionId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Member>()
            .WithMany()
            .HasForeignKey(movement => movement.MemberId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<CashMovement>()
            .WithMany()
            .HasForeignKey(movement => movement.CorrectionOfId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
