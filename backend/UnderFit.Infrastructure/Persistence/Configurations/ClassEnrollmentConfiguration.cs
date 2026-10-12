using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Classes;
using UnderFit.Domain.Members;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class ClassEnrollmentConfiguration : IEntityTypeConfiguration<ClassEnrollment>
{
    public void Configure(EntityTypeBuilder<ClassEnrollment> builder)
    {
        builder.ToTable("class_enrollments");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.MemberIdentityNumber).HasMaxLength(32);
        builder.Property(item => item.MemberName).HasMaxLength(160);
        builder.Property(item => item.EffectiveFrom).HasColumnType("date");
        builder.Property(item => item.EffectiveUntil).HasColumnType("date");
        builder.Property(item => item.Origin).HasMaxLength(32);
        builder.HasIndex(item => new { item.ClassId, item.MemberIdentityNumber })
            .IsUnique().HasFilter("\"ClassId\" IS NOT NULL AND \"IsActive\"");
        builder.HasIndex(item => new { item.ScheduleId, item.MemberIdentityNumber })
            .IsUnique().HasFilter("\"ScheduleId\" IS NOT NULL AND \"IsActive\"");
        builder.HasOne<GymClass>().WithMany().HasForeignKey(item => item.ClassId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<ClassSchedule>().WithMany().HasForeignKey(item => item.ScheduleId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Member>().WithMany().HasForeignKey(item => item.MemberId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
