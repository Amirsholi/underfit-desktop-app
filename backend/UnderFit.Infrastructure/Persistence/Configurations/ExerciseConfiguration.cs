using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Training;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class ExerciseConfiguration : IEntityTypeConfiguration<Exercise>
{
    public void Configure(EntityTypeBuilder<Exercise> builder)
    {
        builder.ToTable("exercises");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Id).UseIdentityByDefaultColumn();
        builder.Property(item => item.Name).HasMaxLength(160);
        builder.Property(item => item.MuscleGroup).HasMaxLength(100);
        builder.Property(item => item.Instructions).HasMaxLength(1000);
        builder.Property(item => item.GifUrl).HasMaxLength(500);
        builder.HasIndex(item => new { item.IsActive, item.MuscleGroup, item.Name });
    }
}
