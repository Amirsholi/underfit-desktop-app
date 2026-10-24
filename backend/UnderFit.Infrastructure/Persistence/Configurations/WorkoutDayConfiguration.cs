using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Training;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class WorkoutDayConfiguration : IEntityTypeConfiguration<WorkoutDay>
{
    public void Configure(EntityTypeBuilder<WorkoutDay> builder)
    {
        builder.ToTable("workout_days");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Name).HasMaxLength(100);
        builder.Property(item => item.MuscleGroups).HasMaxLength(250);
        builder.HasOne(item => item.WorkoutPlan).WithMany(plan => plan.Days)
            .HasForeignKey(item => item.WorkoutPlanId).OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(item => new { item.WorkoutPlanId, item.Position }).IsUnique();
    }
}
