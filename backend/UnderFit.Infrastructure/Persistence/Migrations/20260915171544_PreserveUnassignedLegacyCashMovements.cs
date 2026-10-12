using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PreserveUnassignedLegacyCashMovements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "CashSessionId",
                table: "cash_movements",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<bool>(
                name: "IsLegacyUnassigned",
                table: "cash_movements",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddCheckConstraint(
                name: "CK_cash_movements_legacy_session",
                table: "cash_movements",
                sql: "(\"CashSessionId\" IS NULL) = \"IsLegacyUnassigned\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$ BEGIN
                  IF EXISTS (SELECT 1 FROM cash_movements WHERE "CashSessionId" IS NULL) THEN
                    RAISE EXCEPTION 'Cannot downgrade while unassigned legacy cash movements exist. Restore the pre-migration backup instead.';
                  END IF;
                END $$;
                """);
            migrationBuilder.DropCheckConstraint(
                name: "CK_cash_movements_legacy_session",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "IsLegacyUnassigned",
                table: "cash_movements");

            migrationBuilder.AlterColumn<Guid>(
                name: "CashSessionId",
                table: "cash_movements",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
