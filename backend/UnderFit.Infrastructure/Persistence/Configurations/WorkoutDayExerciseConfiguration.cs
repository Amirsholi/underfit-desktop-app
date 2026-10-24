using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Training;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class WorkoutDayExerciseConfiguration : IEntityTypeConfiguration<WorkoutDayExercise>
{
    public void Configure(EntityTypeBuilder<WorkoutDayExercise> builder)
    {
        builder.ToTable("workout_day_exercises");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Repetitions).HasMaxLength(80);
        builder.Property(item => item.Load).HasMaxLength(80);
        builder.Property(item => item.Notes).HasMaxLength(500);
        builder.HasOne(item => item.WorkoutDay).WithMany(day => day.Exercises)
            .HasForeignKey(item => item.WorkoutDayId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(item => item.Exercise).WithMany().HasForeignKey(item => item.ExerciseId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(item => new { item.WorkoutDayId, item.Position }).IsUnique();
    }
}
