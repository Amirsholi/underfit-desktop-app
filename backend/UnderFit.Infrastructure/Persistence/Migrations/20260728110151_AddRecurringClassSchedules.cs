using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRecurringClassSchedules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ScheduleId",
                table: "gym_classes",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "class_schedules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    LocationId = table.Column<int>(type: "integer", nullable: false),
                    ProfessorId = table.Column<int>(type: "integer", nullable: false),
                    ProfessorName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Weekdays = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Time = table.Column<TimeOnly>(type: "time", nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    StartsOn = table.Column<DateOnly>(type: "date", nullable: false),
                    EndsOn = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_class_schedules", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_gym_classes_ScheduleId_Date_Time",
                table: "gym_classes",
                columns: new[] { "ScheduleId", "Date", "Time" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_class_schedules_IsActive_StartsOn",
                table: "class_schedules",
                columns: new[] { "IsActive", "StartsOn" });

            migrationBuilder.AddForeignKey(
                name: "FK_gym_classes_class_schedules_ScheduleId",
                table: "gym_classes",
                column: "ScheduleId",
                principalTable: "class_schedules",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_gym_classes_class_schedules_ScheduleId",
                table: "gym_classes");

            migrationBuilder.DropTable(
                name: "class_schedules");

            migrationBuilder.DropIndex(
                name: "IX_gym_classes_ScheduleId_Date_Time",
                table: "gym_classes");

            migrationBuilder.DropColumn(
                name: "ScheduleId",
                table: "gym_classes");
        }
    }
}
