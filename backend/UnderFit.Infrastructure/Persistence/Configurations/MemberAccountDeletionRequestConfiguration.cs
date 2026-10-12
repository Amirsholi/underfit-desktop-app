using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Members;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class MemberAccountDeletionRequestConfiguration
    : IEntityTypeConfiguration<MemberAccountDeletionRequest>
{
    public void Configure(EntityTypeBuilder<MemberAccountDeletionRequest> builder)
    {
        builder.ToTable("member_account_deletion_requests");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.MemberIdentityNumber).HasMaxLength(32);
        builder.Property(item => item.MemberName).HasMaxLength(160);
        builder.Property(item => item.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(item => item.ResolutionNote).HasMaxLength(500);
        builder.HasIndex(item => item.MemberId)
            .IsUnique()
            .HasFilter("\"Status\" = 'Pending'");
        builder.HasOne<Member>().WithMany().HasForeignKey(item => item.MemberId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
