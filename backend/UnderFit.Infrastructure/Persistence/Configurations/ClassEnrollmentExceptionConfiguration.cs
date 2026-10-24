using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Classes;
using UnderFit.Domain.Members;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class ClassEnrollmentExceptionConfiguration
    : IEntityTypeConfiguration<ClassEnrollmentException>
{
    public void Configure(EntityTypeBuilder<ClassEnrollmentException> builder)
    {
        builder.ToTable("class_enrollment_exceptions");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.MemberIdentityNumber).HasMaxLength(32);
        builder.Property(item => item.MemberName).HasMaxLength(160);
        builder.Property(item => item.Origin).HasMaxLength(32);
        builder.HasIndex(item => new { item.ClassId, item.MemberIdentityNumber }).IsUnique();
        builder.HasOne<GymClass>().WithMany().HasForeignKey(item => item.ClassId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Member>().WithMany().HasForeignKey(item => item.MemberId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
