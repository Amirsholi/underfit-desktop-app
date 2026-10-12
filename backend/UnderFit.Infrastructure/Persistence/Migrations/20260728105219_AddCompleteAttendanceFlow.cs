using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCompleteAttendanceFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AnnulledAtUtc",
                table: "entries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AnnulmentReason",
                table: "entries",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ClassId",
                table: "entries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAnnulled",
                table: "entries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "LocationId",
                table: "entries",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "MemberIdentityNumber",
                table: "entries",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MemberName",
                table: "entries",
                type: "character varying(160)",
                maxLength: 160,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Observation",
                table: "entries",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnnulledAtUtc",
                table: "entries");

            migrationBuilder.DropColumn(
                name: "AnnulmentReason",
                table: "entries");

            migrationBuilder.DropColumn(
                name: "ClassId",
                table: "entries");

            migrationBuilder.DropColumn(
                name: "IsAnnulled",
                table: "entries");

            migrationBuilder.DropColumn(
                name: "LocationId",
                table: "entries");

            migrationBuilder.DropColumn(
                name: "MemberIdentityNumber",
                table: "entries");

            migrationBuilder.DropColumn(
                name: "MemberName",
                table: "entries");

            migrationBuilder.DropColumn(
                name: "Observation",
                table: "entries");
        }
    }
}
