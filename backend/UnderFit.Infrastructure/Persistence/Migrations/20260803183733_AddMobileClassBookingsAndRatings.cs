using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMobileClassBookingsAndRatings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Origin",
                table: "class_enrollments",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "administration");

            migrationBuilder.AddColumn<int>(
                name: "PerformanceRating",
                table: "class_attendances",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "RatedAtUtc",
                table: "class_attendances",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RatedByProfessorId",
                table: "class_attendances",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "class_enrollment_exceptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClassId = table.Column<int>(type: "integer", nullable: false),
                    MemberId = table.Column<Guid>(type: "uuid", nullable: true),
                    MemberIdentityNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MemberName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Origin = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_class_enrollment_exceptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_class_enrollment_exceptions_gym_classes_ClassId",
                        column: x => x.ClassId,
                        principalTable: "gym_classes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_class_enrollment_exceptions_members_MemberId",
                        column: x => x.MemberId,
                        principalTable: "members",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_class_attendances_RatedByProfessorId",
                table: "class_attendances",
                column: "RatedByProfessorId");

            migrationBuilder.CreateIndex(
                name: "IX_class_enrollment_exceptions_ClassId_MemberIdentityNumber",
                table: "class_enrollment_exceptions",
                columns: new[] { "ClassId", "MemberIdentityNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_class_enrollment_exceptions_MemberId",
                table: "class_enrollment_exceptions",
                column: "MemberId");

            migrationBuilder.AddForeignKey(
                name: "FK_class_attendances_professors_RatedByProfessorId",
                table: "class_attendances",
                column: "RatedByProfessorId",
                principalTable: "professors",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_class_attendances_professors_RatedByProfessorId",
                table: "class_attendances");

            migrationBuilder.DropTable(
                name: "class_enrollment_exceptions");

            migrationBuilder.DropIndex(
                name: "IX_class_attendances_RatedByProfessorId",
                table: "class_attendances");

            migrationBuilder.DropColumn(
                name: "Origin",
                table: "class_enrollments");

            migrationBuilder.DropColumn(
                name: "PerformanceRating",
                table: "class_attendances");

            migrationBuilder.DropColumn(
                name: "RatedAtUtc",
                table: "class_attendances");

            migrationBuilder.DropColumn(
                name: "RatedByProfessorId",
                table: "class_attendances");
        }
    }
}
