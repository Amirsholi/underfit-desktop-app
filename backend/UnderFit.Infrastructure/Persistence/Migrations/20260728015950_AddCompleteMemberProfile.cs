using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCompleteMemberProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Address",
                table: "members",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "BirthDate",
                table: "members",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Details",
                table: "members",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactName",
                table: "members",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactPhone",
                table: "members",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyRelationship",
                table: "members",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Goal",
                table: "members",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ImageUseAuthorized",
                table: "members",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "MedicalCondition",
                table: "members",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentPreference",
                table: "members",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RegistrationPaymentMethod",
                table: "members",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAtUtc",
                table: "members",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Address",
                table: "members");

            migrationBuilder.DropColumn(
                name: "BirthDate",
                table: "members");

            migrationBuilder.DropColumn(
                name: "Details",
                table: "members");

            migrationBuilder.DropColumn(
                name: "EmergencyContactName",
                table: "members");

            migrationBuilder.DropColumn(
                name: "EmergencyContactPhone",
                table: "members");

            migrationBuilder.DropColumn(
                name: "EmergencyRelationship",
                table: "members");

            migrationBuilder.DropColumn(
                name: "Goal",
                table: "members");

            migrationBuilder.DropColumn(
                name: "ImageUseAuthorized",
                table: "members");

            migrationBuilder.DropColumn(
                name: "MedicalCondition",
                table: "members");

            migrationBuilder.DropColumn(
                name: "PaymentPreference",
                table: "members");

            migrationBuilder.DropColumn(
                name: "RegistrationPaymentMethod",
                table: "members");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                table: "members");
        }
    }
}
