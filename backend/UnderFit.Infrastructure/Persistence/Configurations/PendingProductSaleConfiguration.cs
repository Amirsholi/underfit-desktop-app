using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Inventory;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class PendingProductSaleConfiguration : IEntityTypeConfiguration<PendingProductSale>
{
    public void Configure(EntityTypeBuilder<PendingProductSale> builder)
    {
        builder.ToTable("pending_product_sales");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).UseIdentityByDefaultColumn();
        builder.Property(x => x.ProductName).HasMaxLength(160);
        builder.Property(x => x.MemberIdentityNumber).HasMaxLength(32);
        builder.Property(x => x.MemberName).HasMaxLength(160);
        builder.Property(x => x.Total).HasPrecision(12, 2);
        builder.Property(x => x.Professor).HasMaxLength(160);
        builder.Property(x => x.Note).HasMaxLength(500);
        builder.Property(x => x.PaymentMethod).HasMaxLength(40);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        builder.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => new { x.Status, x.OccurredAtUtc });
    }
}
