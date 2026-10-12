using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using UnderFit.Application.Abstractions;
using UnderFit.Infrastructure.Persistence;

namespace UnderFit.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddUnderFitInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("UnderFit");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("ConnectionStrings:UnderFit is required.");
        }

        services.AddDbContext<UnderFitDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<IUnderFitDataStore>(provider => provider.GetRequiredService<UnderFitDbContext>());
        return services;
    }
}
