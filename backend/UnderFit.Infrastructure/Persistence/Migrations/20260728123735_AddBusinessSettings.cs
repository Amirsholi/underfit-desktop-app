using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBusinessSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "business_settings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    RunningEventActive = table.Column<bool>(type: "boolean", nullable: false),
                    RunningEventName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    RunningEventDistances = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    RunningEventDate = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_business_settings", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "business_settings");
        }
    }
}
