using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UnderFit.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TabletAccessAndTraining : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProfessorId",
                table: "workout_templates",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "ProfessorSessionId",
                table: "pending_product_sales",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<bool>(
                name: "IsTrial",
                table: "class_schedules",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$ BEGIN
                  IF EXISTS (SELECT 1 FROM pending_product_sales WHERE "ProfessorSessionId" IS NULL) THEN
                    RAISE EXCEPTION 'Cannot downgrade while tablet sales without professor sessions exist.';
                  END IF;
                END $$;
                """);
            migrationBuilder.DropColumn(
                name: "ProfessorId",
                table: "workout_templates");

            migrationBuilder.DropColumn(
                name: "IsTrial",
                table: "class_schedules");

            migrationBuilder.AlterColumn<int>(
                name: "ProfessorSessionId",
                table: "pending_product_sales",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
