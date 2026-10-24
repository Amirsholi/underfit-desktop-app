using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Members;
using UnderFit.Domain.Cash;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class MembershipRenewalConfiguration : IEntityTypeConfiguration<MembershipRenewal>
{
    public void Configure(EntityTypeBuilder<MembershipRenewal> builder)
    {
        builder.ToTable("membership_renewals");
        builder.HasKey(renewal => renewal.Id);
        builder.Property(renewal => renewal.Plan).HasConversion<string>().HasMaxLength(24);
        builder.Property(renewal => renewal.PaidOn).HasColumnType("date");
        builder.Property(renewal => renewal.PreviousExpiration).HasColumnType("date");
        builder.Property(renewal => renewal.NewExpiration).HasColumnType("date");
        builder.Property(renewal => renewal.MemberName).HasMaxLength(160);
        builder.Property(renewal => renewal.Amount).HasPrecision(12, 2);
        builder.Property(renewal => renewal.PaymentMethod).HasMaxLength(40);
        builder.Property(renewal => renewal.Notes).HasMaxLength(1000);
        builder.HasOne<Member>()
            .WithMany()
            .HasForeignKey(renewal => renewal.MemberId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<CashSession>()
            .WithMany()
            .HasForeignKey(renewal => renewal.CashSessionId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<CashMovement>()
            .WithMany()
            .HasForeignKey(renewal => renewal.CashMovementId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
