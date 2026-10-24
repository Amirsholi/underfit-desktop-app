using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class IdempotentRequestConfiguration : IEntityTypeConfiguration<IdempotentRequest>
{
    public void Configure(EntityTypeBuilder<IdempotentRequest> builder)
    {
        builder.ToTable("idempotent_requests");
        builder.HasKey(item => new { item.Scope, item.Key });
        builder.Property(item => item.Scope).HasMaxLength(180);
        builder.Property(item => item.Key).HasMaxLength(100);
        builder.Property(item => item.RequestHash).HasMaxLength(64);
        builder.Property(item => item.ResponseContentType).HasMaxLength(120);
        builder.Property(item => item.ResponseBody).HasColumnType("text");
        builder.HasIndex(item => item.CreatedAtUtc);
    }
}
