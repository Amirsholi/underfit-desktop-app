using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Members;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class MemberMobileAccountConfiguration : IEntityTypeConfiguration<MemberMobileAccount>
{
    public void Configure(EntityTypeBuilder<MemberMobileAccount> builder)
    {
        builder.ToTable("member_mobile_accounts");
        builder.HasKey(account => account.MemberId);
        builder.Property(account => account.PasswordHash).HasMaxLength(64);
        builder.Property(account => account.PasswordSalt).HasMaxLength(32);
        builder.HasOne(account => account.Member).WithOne()
            .HasForeignKey<MemberMobileAccount>(account => account.MemberId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
