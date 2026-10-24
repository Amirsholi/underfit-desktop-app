using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CashProductSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProductId",
                table: "cash_movements",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProductName",
                table: "cash_movements",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProductQuantity",
                table: "cash_movements",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ProductId",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "ProductName",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "ProductQuantity",
                table: "cash_movements");
        }
    }
}
