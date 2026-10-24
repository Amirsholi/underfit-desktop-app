using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Training;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class WorkoutTemplateConfiguration : IEntityTypeConfiguration<WorkoutTemplate>
{
    public void Configure(EntityTypeBuilder<WorkoutTemplate> builder)
    {
        builder.ToTable("workout_templates");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Name).HasMaxLength(160);
        builder.Property(item => item.DaysJson).HasColumnType("jsonb");
        builder.HasIndex(item => item.Name);
    }
}
