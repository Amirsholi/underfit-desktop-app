using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Inventory;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class ProductSaleConfiguration : IEntityTypeConfiguration<ProductSale>
{
    public void Configure(EntityTypeBuilder<ProductSale> builder)
    {
        builder.ToTable("product_sales");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).UseIdentityByDefaultColumn();
        builder.Property(x => x.ProductName).HasMaxLength(160);
        builder.Property(x => x.Total).HasPrecision(12, 2);
        builder.Property(x => x.ReceivedAmount).HasPrecision(12, 2);
        builder.Property(x => x.Change).HasPrecision(12, 2);
        builder.Property(x => x.PaymentMethod).HasMaxLength(40);
        builder.Property(x => x.Note).HasMaxLength(500);
        builder.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => x.OccurredAtUtc);
    }
}
