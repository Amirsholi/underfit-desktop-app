using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMembershipPaymentsAndCashFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                table: "membership_renewals",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "CashMovementId",
                table: "membership_renewals",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CashSessionId",
                table: "membership_renewals",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MemberName",
                table: "membership_renewals",
                type: "character varying(160)",
                maxLength: 160,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "membership_renewals",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PaidAtUtc",
                table: "membership_renewals",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "membership_renewals",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "cash_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BusinessDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Cashier = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    OpeningCash = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    OpenedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cash_sessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "membership_prices",
                columns: table => new
                {
                    Plan = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_membership_prices", x => x.Plan);
                });

            migrationBuilder.CreateTable(
                name: "cash_movements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CashSessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    MemberId = table.Column<Guid>(type: "uuid", nullable: false),
                    MemberIdentityNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MemberName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    PaymentMethod = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    OccurredAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cash_movements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_cash_movements_cash_sessions_CashSessionId",
                        column: x => x.CashSessionId,
                        principalTable: "cash_sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_cash_movements_members_MemberId",
                        column: x => x.MemberId,
                        principalTable: "members",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_membership_renewals_CashMovementId",
                table: "membership_renewals",
                column: "CashMovementId");

            migrationBuilder.CreateIndex(
                name: "IX_membership_renewals_CashSessionId",
                table: "membership_renewals",
                column: "CashSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_cash_movements_CashSessionId_OccurredAtUtc",
                table: "cash_movements",
                columns: new[] { "CashSessionId", "OccurredAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_cash_movements_MemberId",
                table: "cash_movements",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_cash_sessions_BusinessDate",
                table: "cash_sessions",
                column: "BusinessDate");

            migrationBuilder.CreateIndex(
                name: "IX_cash_sessions_Status",
                table: "cash_sessions",
                column: "Status",
                unique: true,
                filter: "\"Status\" = 'Open'");

            migrationBuilder.AddForeignKey(
                name: "FK_membership_renewals_cash_movements_CashMovementId",
                table: "membership_renewals",
                column: "CashMovementId",
                principalTable: "cash_movements",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_membership_renewals_cash_sessions_CashSessionId",
                table: "membership_renewals",
                column: "CashSessionId",
                principalTable: "cash_sessions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_membership_renewals_cash_movements_CashMovementId",
                table: "membership_renewals");

            migrationBuilder.DropForeignKey(
                name: "FK_membership_renewals_cash_sessions_CashSessionId",
                table: "membership_renewals");

            migrationBuilder.DropTable(
                name: "cash_movements");

            migrationBuilder.DropTable(
                name: "membership_prices");

            migrationBuilder.DropTable(
                name: "cash_sessions");

            migrationBuilder.DropIndex(
                name: "IX_membership_renewals_CashMovementId",
                table: "membership_renewals");

            migrationBuilder.DropIndex(
                name: "IX_membership_renewals_CashSessionId",
                table: "membership_renewals");

            migrationBuilder.DropColumn(
                name: "Amount",
                table: "membership_renewals");

            migrationBuilder.DropColumn(
                name: "CashMovementId",
                table: "membership_renewals");

            migrationBuilder.DropColumn(
                name: "CashSessionId",
                table: "membership_renewals");

            migrationBuilder.DropColumn(
                name: "MemberName",
                table: "membership_renewals");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "membership_renewals");

            migrationBuilder.DropColumn(
                name: "PaidAtUtc",
                table: "membership_renewals");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "membership_renewals");
        }
    }
}
