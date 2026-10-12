using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Members;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class MembershipPriceConfiguration : IEntityTypeConfiguration<MembershipPrice>
{
    public void Configure(EntityTypeBuilder<MembershipPrice> builder)
    {
        builder.ToTable("membership_prices");
        builder.HasKey(price => price.Plan);
        builder.Property(price => price.Plan).HasConversion<string>().HasMaxLength(24);
        builder.Property(price => price.Amount).HasPrecision(12, 2);
    }
}
