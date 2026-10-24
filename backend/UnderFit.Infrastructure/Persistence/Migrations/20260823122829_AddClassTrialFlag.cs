using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClassTrialFlag : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsTrial",
                table: "gym_classes",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsTrial",
                table: "gym_classes");
        }
    }
}
