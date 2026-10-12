using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Settings;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class BusinessSettingsConfiguration : IEntityTypeConfiguration<BusinessSettings>
{
    public void Configure(EntityTypeBuilder<BusinessSettings> builder)
    {
        builder.ToTable("business_settings");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.RunningEventName).HasMaxLength(160);
        builder.Property(x => x.RunningEventDistances).HasMaxLength(160);
        builder.Property(x => x.RunningEventLegend).HasMaxLength(160).HasDefaultValue("ya falta menos");
    }
}
