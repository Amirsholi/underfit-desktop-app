using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProductLocationAvailability : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AvailableLocal1",
                table: "products",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AvailableLocal2",
                table: "products",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            // Previously only active products were offered in either local.
            // Do not reintroduce inactive legacy items when adding these tables.
            migrationBuilder.Sql("UPDATE products SET \"AvailableLocal1\" = \"IsActive\", \"AvailableLocal2\" = \"IsActive\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AvailableLocal1",
                table: "products");

            migrationBuilder.DropColumn(
                name: "AvailableLocal2",
                table: "products");
        }
    }
}
