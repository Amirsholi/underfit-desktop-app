using UnderFit.Application.Abstractions;
using UnderFit.Application.Common;
using UnderFit.Domain.Staff;

namespace UnderFit.Application.Staff;

// Internal attribution records preserve historical foreign keys; operators type a name.
public static class ProfessorAttribution
{
    public static async Task<Professor> ResolveAsync(IUnderFitDataStore store, string? name,
        int? legacyId, TimeProvider clock, CancellationToken ct)
    {
        if (name is null && legacyId is > 0)
            return await store.FindProfessorAsync(legacyId.Value, ct)
                ?? throw new UseCaseException("staff.not_found", "No se encontró el responsable.");
        var normalized = string.Join(' ', (name ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries));
        if (normalized.Length is < 2 or > 80)
            throw new UseCaseException("staff.name_required", "Escribí el nombre del profesor (entre 2 y 80 caracteres).");
        var existing = (await store.ListProfessorsAsync(true, ct))
            .FirstOrDefault(x => x.Name.Equals(normalized, StringComparison.OrdinalIgnoreCase) && x.IsActive);
        if (existing is not null) return existing;
        var item = new Professor(normalized, "", "", clock.GetUtcNow());
        store.AddProfessor(item);
        await store.SaveChangesAsync(ct);
        return item;
    }
}
