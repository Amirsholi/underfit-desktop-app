using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Classes;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class GymClassConfiguration : IEntityTypeConfiguration<GymClass>
{
    public void Configure(EntityTypeBuilder<GymClass> builder)
    {
        builder.ToTable("gym_classes");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Name).HasMaxLength(160);
        builder.Property(item => item.Date).HasColumnType("date");
        builder.Property(item => item.Time).HasColumnType("time");
        builder.Property(item => item.ProfessorName).HasMaxLength(160);
        builder.Property(item => item.Notes).HasMaxLength(1000);
        builder.Property(item => item.Status).HasConversion<string>().HasMaxLength(24);
        builder.HasIndex(item => new { item.Date, item.Time });
        builder.HasIndex(item => new { item.ScheduleId, item.Date, item.Time }).IsUnique();
        builder.HasOne(item => item.Schedule).WithMany().HasForeignKey(item => item.ScheduleId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
