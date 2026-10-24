using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Training;

namespace UnderFit.Infrastructure.Persistence.Configurations;

public sealed class WorkoutPlanConfiguration : IEntityTypeConfiguration<WorkoutPlan>
{
    public void Configure(EntityTypeBuilder<WorkoutPlan> builder)
    {
        builder.ToTable("workout_plans");
        builder.HasKey(item => item.Id);
        builder.Property(item => item.Name).HasMaxLength(160);
        builder.HasOne(item => item.Member).WithMany().HasForeignKey(item => item.MemberId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(item => item.Professor).WithMany().HasForeignKey(item => item.ProfessorId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(item => new { item.MemberId, item.IsActive });
    }
}
