using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Members;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class MemberConfiguration : IEntityTypeConfiguration<Member>
{
    public void Configure(EntityTypeBuilder<Member> builder)
    {
        builder.ToTable("members");
        builder.HasKey(member => member.Id);
        builder.Property(member => member.IdentityNumber).HasMaxLength(32).IsRequired();
        builder.HasIndex(member => member.IdentityNumber).IsUnique();
        builder.Property(member => member.Name).HasMaxLength(160).IsRequired();
        builder.Property(member => member.Phone).HasMaxLength(40);
        builder.Property(member => member.Email).HasMaxLength(254);
        builder.Property(member => member.Details).HasMaxLength(2000);
        builder.Property(member => member.EmergencyContactName).HasMaxLength(160);
        builder.Property(member => member.EmergencyContactPhone).HasMaxLength(40);
        builder.Property(member => member.BirthDate).HasColumnType("date");
        builder.Property(member => member.Address).HasMaxLength(300);
        builder.Property(member => member.EmergencyRelationship).HasMaxLength(100);
        builder.Property(member => member.MedicalCondition).HasMaxLength(1000);
        builder.Property(member => member.Goal).HasMaxLength(1000);
        builder.Property(member => member.RegistrationPaymentMethod).HasMaxLength(40);
        builder.Property(member => member.PaymentPreference).HasMaxLength(40);
        builder.Property(member => member.CurrentMembershipPlan)
            .HasConversion<string>()
            .HasMaxLength(24);
        builder.Property(member => member.MembershipExpiresOn).HasColumnType("date");
    }
}
