using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClassEnrollments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "class_enrollments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClassId = table.Column<int>(type: "integer", nullable: true),
                    ScheduleId = table.Column<int>(type: "integer", nullable: true),
                    MemberId = table.Column<Guid>(type: "uuid", nullable: true),
                    MemberIdentityNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MemberName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_class_enrollments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_class_enrollments_class_schedules_ScheduleId",
                        column: x => x.ScheduleId,
                        principalTable: "class_schedules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_class_enrollments_gym_classes_ClassId",
                        column: x => x.ClassId,
                        principalTable: "gym_classes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_class_enrollments_members_MemberId",
                        column: x => x.MemberId,
                        principalTable: "members",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_class_enrollments_ClassId_MemberIdentityNumber",
                table: "class_enrollments",
                columns: new[] { "ClassId", "MemberIdentityNumber" },
                unique: true,
                filter: "\"ClassId\" IS NOT NULL AND \"IsActive\"");

            migrationBuilder.CreateIndex(
                name: "IX_class_enrollments_MemberId",
                table: "class_enrollments",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_class_enrollments_ScheduleId_MemberIdentityNumber",
                table: "class_enrollments",
                columns: new[] { "ScheduleId", "MemberIdentityNumber" },
                unique: true,
                filter: "\"ScheduleId\" IS NOT NULL AND \"IsActive\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "class_enrollments");
        }
    }
}
