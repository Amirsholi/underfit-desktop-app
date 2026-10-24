using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCashClosure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CashDifference",
                table: "cash_sessions",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ClosedAtUtc",
                table: "cash_sessions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClosingCashier",
                table: "cash_sessions",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClosingNote",
                table: "cash_sessions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CountedCash",
                table: "cash_sessions",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ExpectedCash",
                table: "cash_sessions",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "MovementCount",
                table: "cash_sessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalCash",
                table: "cash_sessions",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalIncome",
                table: "cash_sessions",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalTransfer",
                table: "cash_sessions",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CashDifference",
                table: "cash_sessions");

            migrationBuilder.DropColumn(
                name: "ClosedAtUtc",
                table: "cash_sessions");

            migrationBuilder.DropColumn(
                name: "ClosingCashier",
                table: "cash_sessions");

            migrationBuilder.DropColumn(
                name: "ClosingNote",
                table: "cash_sessions");

            migrationBuilder.DropColumn(
                name: "CountedCash",
                table: "cash_sessions");

            migrationBuilder.DropColumn(
                name: "ExpectedCash",
                table: "cash_sessions");

            migrationBuilder.DropColumn(
                name: "MovementCount",
                table: "cash_sessions");

            migrationBuilder.DropColumn(
                name: "TotalCash",
                table: "cash_sessions");

            migrationBuilder.DropColumn(
                name: "TotalIncome",
                table: "cash_sessions");

            migrationBuilder.DropColumn(
                name: "TotalTransfer",
                table: "cash_sessions");
        }
    }
}
