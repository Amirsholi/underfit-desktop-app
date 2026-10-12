using System.Diagnostics;

namespace UnderFit.Api.Media;

public sealed class ExerciseVideoProcessor(IConfiguration configuration)
{
    public const long MaximumBytes = 80 * 1024 * 1024;
    // Keep identical to services/exerciseVideoProcessor.js.
    public const string VideoFilter = "scale=w='trunc(ih*dar/2)*2':h=ih,setsar=1,crop=w='min(iw,ih)':h='min(iw,ih)',scale=720:720,setsar=1,fps=24";
    private static readonly HashSet<string> AllowedExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".mp4", ".mov", ".m4v", ".avi", ".webm", ".gif" };

    public string StoragePath { get; } =
        configuration["Media:StoragePath"] ??
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "UnderFit",
            "media",
            "exercises");

    public async Task<string> ProcessAsync(IFormFile file, CancellationToken cancellationToken)
    {
        var extension = Path.GetExtension(file.FileName);
        if (!AllowedExtensions.Contains(extension))
            throw new InvalidOperationException("El archivo debe ser un video MP4, MOV, M4V, AVI o WEBM.");
        if (file.Length is <= 0 or > MaximumBytes)
            throw new InvalidOperationException("El video debe pesar menos de 80 MB.");

        Directory.CreateDirectory(StoragePath);
        var token = Guid.NewGuid().ToString("N");
        var inputPath = Path.Combine(StoragePath, $"{token}.upload{extension}");
        var outputName = $"{token}.mp4";
        var outputPath = Path.Combine(StoragePath, outputName);
        try
        {
            await using (var stream = File.Create(inputPath))
                await file.CopyToAsync(stream, cancellationToken);

            var start = new ProcessStartInfo
            {
                FileName = configuration["Media:FfmpegPath"] ?? "ffmpeg",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardError = true,
                RedirectStandardOutput = true,
            };
            foreach (var argument in new[]
            {
                "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", inputPath,
                "-map", "0:v:0", "-t", "15", "-an", "-vf", VideoFilter,
                "-c:v", "libx264", "-preset", "fast", "-crf", "26",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath
            })
                start.ArgumentList.Add(argument);

            using var process = Process.Start(start)
                ?? throw new InvalidOperationException("No se pudo iniciar el procesador de video.");
            var error = await process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);
            if (process.ExitCode != 0 || !File.Exists(outputPath))
                throw new InvalidOperationException(
                    $"No se pudo procesar el video. {LastLine(error)}");
            return outputName;
        }
        catch
        {
            if (File.Exists(outputPath)) File.Delete(outputPath);
            throw;
        }
        finally
        {
            if (File.Exists(inputPath)) File.Delete(inputPath);
        }
    }

    private static string LastLine(string value) =>
        value.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? string.Empty;
}
