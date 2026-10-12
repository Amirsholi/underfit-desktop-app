using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Attendance;
using UnderFit.Domain.Members;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class EntryConfiguration : IEntityTypeConfiguration<Entry>
{
    public void Configure(EntityTypeBuilder<Entry> builder)
    {
        builder.ToTable("entries");
        builder.HasKey(entry => entry.Id);
        builder.Property(entry => entry.Source).HasMaxLength(40).IsRequired();
        builder.Property(entry => entry.DeviceId).HasMaxLength(100);
        builder.Property(entry => entry.MemberIdentityNumber).HasMaxLength(32);
        builder.Property(entry => entry.MemberName).HasMaxLength(160);
        builder.Property(entry => entry.Observation).HasMaxLength(500);
        builder.Property(entry => entry.AnnulmentReason).HasMaxLength(500);
        builder.HasIndex(entry => new { entry.MemberId, entry.OccurredAtUtc });
        builder.HasOne<Member>()
            .WithMany()
            .HasForeignKey(entry => entry.MemberId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
