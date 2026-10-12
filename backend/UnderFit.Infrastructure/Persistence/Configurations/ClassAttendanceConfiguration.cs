using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnderFit.Domain.Attendance;
using UnderFit.Domain.Classes;
using UnderFit.Domain.Members;
using UnderFit.Domain.Staff;
namespace UnderFit.Infrastructure.Persistence.Configurations;
public sealed class ClassAttendanceConfiguration:IEntityTypeConfiguration<ClassAttendance>
{
 public void Configure(EntityTypeBuilder<ClassAttendance>b){
  b.ToTable("class_attendances");b.HasKey(x=>x.Id);
  b.Property(x=>x.MemberIdentityNumber).HasMaxLength(32);b.Property(x=>x.MemberName).HasMaxLength(160);b.Property(x=>x.DeviceId).HasMaxLength(100);
  b.HasIndex(x=>new{x.ClassId,x.MemberIdentityNumber}).IsUnique().HasFilter("NOT \"IsAnnulled\"");
  b.HasOne<GymClass>().WithMany().HasForeignKey(x=>x.ClassId).OnDelete(DeleteBehavior.Restrict);
  b.HasOne<ClassSchedule>().WithMany().HasForeignKey(x=>x.ScheduleId).OnDelete(DeleteBehavior.Restrict);
  b.HasOne<Member>().WithMany().HasForeignKey(x=>x.MemberId).OnDelete(DeleteBehavior.SetNull);
  b.HasOne<Entry>().WithMany().HasForeignKey(x=>x.EntryId).OnDelete(DeleteBehavior.Restrict);
  b.HasOne<Professor>().WithMany().HasForeignKey(x=>x.ProfessorId).OnDelete(DeleteBehavior.Restrict);
  b.HasOne<ProfessorSession>().WithMany().HasForeignKey(x=>x.ProfessorSessionId).OnDelete(DeleteBehavior.Restrict).IsRequired(false);
  b.HasOne<Professor>().WithMany().HasForeignKey(x=>x.RatedByProfessorId).OnDelete(DeleteBehavior.Restrict);
 }}
