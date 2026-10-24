using Microsoft.EntityFrameworkCore;
using UnderFit.Infrastructure.Persistence;

namespace UnderFit.Api.Media;

public sealed class ExerciseMediaCleanupService(
    IServiceScopeFactory scopeFactory,
    ExerciseVideoProcessor processor,
    ILogger<ExerciseMediaCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupAsync(stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning(exception, "Exercise media cleanup could not be completed.");
            }
            await Task.Delay(TimeSpan.FromHours(12), stoppingToken);
        }
    }

    private async Task CleanupAsync(CancellationToken cancellationToken)
    {
        if (!Directory.Exists(processor.StoragePath)) return;
        await using var scope = scopeFactory.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<UnderFitDbContext>();
        var referenced = (await database.Exercises
                .AsNoTracking()
                .Where(item => item.GifUrl != null)
                .Select(item => item.GifUrl!)
                .ToArrayAsync(cancellationToken))
            .Select(value => Path.GetFileName(new Uri(value, UriKind.RelativeOrAbsolute).IsAbsoluteUri
                ? new Uri(value).AbsolutePath
                : value))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var now = DateTime.UtcNow;
        foreach (var path in Directory.EnumerateFiles(processor.StoragePath))
        {
            var file = new FileInfo(path);
            var isInterruptedUpload =
                file.Name.Contains(".upload", StringComparison.OrdinalIgnoreCase) &&
                now - file.LastWriteTimeUtc > TimeSpan.FromHours(1);
            var isOrphanMp4 =
                file.Extension.Equals(".mp4", StringComparison.OrdinalIgnoreCase) &&
                !referenced.Contains(file.Name) &&
                now - file.LastWriteTimeUtc > TimeSpan.FromHours(24);
            if (isInterruptedUpload || isOrphanMp4)
                file.Delete();
        }
    }
}
