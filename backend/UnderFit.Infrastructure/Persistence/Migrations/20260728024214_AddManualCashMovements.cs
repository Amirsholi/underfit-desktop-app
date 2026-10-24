using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddManualCashMovements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "MemberId",
                table: "cash_movements",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "CorrectionOfId",
                table: "cash_movements",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CorrectionReason",
                table: "cash_movements",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "cash_movements",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_cash_movements_CorrectionOfId",
                table: "cash_movements",
                column: "CorrectionOfId");

            migrationBuilder.AddForeignKey(
                name: "FK_cash_movements_cash_movements_CorrectionOfId",
                table: "cash_movements",
                column: "CorrectionOfId",
                principalTable: "cash_movements",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_cash_movements_cash_movements_CorrectionOfId",
                table: "cash_movements");

            migrationBuilder.DropIndex(
                name: "IX_cash_movements_CorrectionOfId",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "CorrectionOfId",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "CorrectionReason",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "Note",
                table: "cash_movements");

            migrationBuilder.AlterColumn<Guid>(
                name: "MemberId",
                table: "cash_movements",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
