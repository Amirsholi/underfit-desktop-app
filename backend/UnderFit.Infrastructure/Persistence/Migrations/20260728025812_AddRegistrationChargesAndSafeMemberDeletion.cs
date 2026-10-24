using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRegistrationChargesAndSafeMemberDeletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_cash_movements_members_MemberId",
                table: "cash_movements");

            migrationBuilder.DropForeignKey(
                name: "FK_entries_members_MemberId",
                table: "entries");

            migrationBuilder.DropForeignKey(
                name: "FK_membership_renewals_members_MemberId",
                table: "membership_renewals");

            migrationBuilder.AlterColumn<Guid>(
                name: "MemberId",
                table: "membership_renewals",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AlterColumn<Guid>(
                name: "MemberId",
                table: "entries",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.CreateTable(
                name: "registration_price",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_registration_price", x => x.Id);
                });

            migrationBuilder.AddForeignKey(
                name: "FK_cash_movements_members_MemberId",
                table: "cash_movements",
                column: "MemberId",
                principalTable: "members",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_entries_members_MemberId",
                table: "entries",
                column: "MemberId",
                principalTable: "members",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_membership_renewals_members_MemberId",
                table: "membership_renewals",
                column: "MemberId",
                principalTable: "members",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_cash_movements_members_MemberId",
                table: "cash_movements");

            migrationBuilder.DropForeignKey(
                name: "FK_entries_members_MemberId",
                table: "entries");

            migrationBuilder.DropForeignKey(
                name: "FK_membership_renewals_members_MemberId",
                table: "membership_renewals");

            migrationBuilder.DropTable(
                name: "registration_price");

            migrationBuilder.AlterColumn<Guid>(
                name: "MemberId",
                table: "membership_renewals",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "MemberId",
                table: "entries",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_cash_movements_members_MemberId",
                table: "cash_movements",
                column: "MemberId",
                principalTable: "members",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_entries_members_MemberId",
                table: "entries",
                column: "MemberId",
                principalTable: "members",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_membership_renewals_members_MemberId",
                table: "membership_renewals",
                column: "MemberId",
                principalTable: "members",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
