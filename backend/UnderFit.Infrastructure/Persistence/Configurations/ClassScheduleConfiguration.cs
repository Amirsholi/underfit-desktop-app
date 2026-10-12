using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Classes;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class ClassScheduleConfiguration : IEntityTypeConfiguration<ClassSchedule>
{
    public void Configure(EntityTypeBuilder<ClassSchedule> builder)
    {
        builder.ToTable("class_schedules");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Name).HasMaxLength(160);
        builder.Property(item => item.ProfessorName).HasMaxLength(160);
        builder.Property(item => item.Weekdays).HasMaxLength(20);
        builder.Property(item => item.Time).HasColumnType("time");
        builder.Property(item => item.StartsOn).HasColumnType("date");
        builder.Property(item => item.EndsOn).HasColumnType("date");
        builder.Property(item => item.Notes).HasMaxLength(1000);
        builder.HasIndex(item => new { item.IsActive, item.StartsOn });
    }
}
