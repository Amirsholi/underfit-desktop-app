using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Staff;
namespace UnderFit.Infrastructure.Persistence.Configurations;
public sealed class ProfessorConfiguration : IEntityTypeConfiguration<Professor>
{
    public void Configure(EntityTypeBuilder<Professor> b) { b.ToTable("professors"); b.HasKey(x=>x.Id); b.Property(x=>x.Name).HasMaxLength(80); b.HasIndex(x=>x.Name).IsUnique(); b.Property(x=>x.PinHash).HasMaxLength(128); b.Property(x=>x.PinSalt).HasMaxLength(64); }
}
public sealed class ProfessorSessionConfiguration : IEntityTypeConfiguration<ProfessorSession>
{
    public void Configure(EntityTypeBuilder<ProfessorSession> b) { b.ToTable("professor_sessions"); b.HasKey(x=>x.Id); b.Property(x=>x.ProfessorName).HasMaxLength(80); b.Property(x=>x.DeviceId).HasMaxLength(100); b.HasIndex(x=>x.DeviceId).IsUnique().HasFilter("\"IsActive\""); b.HasOne<Professor>().WithMany().HasForeignKey(x=>x.ProfessorId).OnDelete(DeleteBehavior.Restrict); }
}
