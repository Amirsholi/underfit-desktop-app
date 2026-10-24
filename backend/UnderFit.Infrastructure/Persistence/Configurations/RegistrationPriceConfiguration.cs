using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Members;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class RegistrationPriceConfiguration : IEntityTypeConfiguration<RegistrationPrice>
{
    public void Configure(EntityTypeBuilder<RegistrationPrice> builder)
    {
        builder.ToTable("registration_price");
        builder.HasKey(price => price.Id);
        builder.Property(price => price.Amount).HasPrecision(12, 2);
    }
}
