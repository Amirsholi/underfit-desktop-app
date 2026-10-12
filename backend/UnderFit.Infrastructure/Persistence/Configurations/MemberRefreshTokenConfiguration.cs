using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Members;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class MemberRefreshTokenConfiguration : IEntityTypeConfiguration<MemberRefreshToken>
{
    public void Configure(EntityTypeBuilder<MemberRefreshToken> builder)
    {
        builder.ToTable("member_refresh_tokens");
        builder.HasKey(token => token.Id);
        builder.Property(token => token.TokenHash).HasMaxLength(32);
        builder.HasIndex(token => token.TokenHash).IsUnique();
        builder.HasIndex(token => new { token.MemberId, token.ExpiresAtUtc });
        builder.HasOne(token => token.Account).WithMany()
            .HasForeignKey(token => token.MemberId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
