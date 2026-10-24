using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClassAttendance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "class_attendances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClassId = table.Column<int>(type: "integer", nullable: false),
                    ScheduleId = table.Column<int>(type: "integer", nullable: true),
                    MemberId = table.Column<Guid>(type: "uuid", nullable: true),
                    MemberIdentityNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MemberName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<int>(type: "integer", nullable: false),
                    ProfessorId = table.Column<int>(type: "integer", nullable: false),
                    ProfessorSessionId = table.Column<int>(type: "integer", nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    OccurredAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IsAnnulled = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_class_attendances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_class_attendances_class_schedules_ScheduleId",
                        column: x => x.ScheduleId,
                        principalTable: "class_schedules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_class_attendances_entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_class_attendances_gym_classes_ClassId",
                        column: x => x.ClassId,
                        principalTable: "gym_classes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_class_attendances_members_MemberId",
                        column: x => x.MemberId,
                        principalTable: "members",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_class_attendances_professor_sessions_ProfessorSessionId",
                        column: x => x.ProfessorSessionId,
                        principalTable: "professor_sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_class_attendances_professors_ProfessorId",
                        column: x => x.ProfessorId,
                        principalTable: "professors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_class_attendances_ClassId_MemberIdentityNumber",
                table: "class_attendances",
                columns: new[] { "ClassId", "MemberIdentityNumber" },
                unique: true,
                filter: "NOT \"IsAnnulled\"");

            migrationBuilder.CreateIndex(
                name: "IX_class_attendances_EntryId",
                table: "class_attendances",
                column: "EntryId");

            migrationBuilder.CreateIndex(
                name: "IX_class_attendances_MemberId",
                table: "class_attendances",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_class_attendances_ProfessorId",
                table: "class_attendances",
                column: "ProfessorId");

            migrationBuilder.CreateIndex(
                name: "IX_class_attendances_ProfessorSessionId",
                table: "class_attendances",
                column: "ProfessorSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_class_attendances_ScheduleId",
                table: "class_attendances",
                column: "ScheduleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "class_attendances");
        }
    }
}
