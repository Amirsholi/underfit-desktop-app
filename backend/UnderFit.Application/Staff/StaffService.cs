using System.Security.Cryptography;
using UnderFit.Application.Abstractions;
using UnderFit.Application.Common;
using UnderFit.Contracts.Staff;
using UnderFit.Domain.Staff;
namespace UnderFit.Application.Staff;
public sealed class StaffService(IUnderFitDataStore store,TimeProvider time)
{
    public async Task<IReadOnlyList<ProfessorResponse>> ListAsync(bool all,CancellationToken ct)=>(await store.ListProfessorsAsync(all,ct)).Select(Map).ToArray();
    public async Task<ProfessorResponse> CreateAsync(CreateProfessorRequest r,CancellationToken ct){var (h,s)=string.IsNullOrWhiteSpace(r.Pin)?("",""):Hash(ValidatePin(r.Pin));var p=new Professor(r.Name,h,s,time.GetUtcNow());store.AddProfessor(p);await store.SaveChangesAsync(ct);return Map(p);}
    public async Task<ProfessorResponse> UpdateAsync(int id,UpdateProfessorRequest r,CancellationToken ct){var p=await store.FindProfessorAsync(id,ct)??throw new UseCaseException("staff.not_found","Professor was not found.");string? h=null,s=null;if(!string.IsNullOrWhiteSpace(r.Pin))(h,s)=Hash(ValidatePin(r.Pin));p.Update(r.Name,h,s,r.Active,time.GetUtcNow());if(r.Active==false)foreach(var x in await store.ListActiveProfessorSessionsAsync(id,ct))x.Finish(time.GetUtcNow());await store.SaveChangesAsync(ct);return Map(p);}
    public async Task<ProfessorSessionResponse> StartAsync(StartProfessorSessionRequest r,CancellationToken ct){var p=await store.FindProfessorAsync(r.ProfessorId,ct);if(p is null||!p.IsActive)throw new UseCaseException("staff.unavailable","Professor is unavailable.");if(!Verify(ValidatePin(r.Pin),p))throw new UseCaseException("staff.invalid_pin","PIN is incorrect.");if(r.LocationId<=0||string.IsNullOrWhiteSpace(r.DeviceId))throw new UseCaseException("staff.invalid_session","Location and device are required.");var old=await store.FindActiveProfessorSessionByDeviceAsync(r.DeviceId.Trim(),ct);old?.Finish(time.GetUtcNow());var x=new ProfessorSession(p.Id,p.Name,r.LocationId,r.DeviceId.Trim(),time.GetUtcNow());store.AddProfessorSession(x);await store.SaveChangesAsync(ct);return Map(x);}
    public async Task<ProfessorSessionResponse?> CurrentAsync(string device,CancellationToken ct){var x=await store.FindActiveProfessorSessionByDeviceAsync(device,ct);return x is null?null:Map(x);}
    public async Task<FinishProfessorSessionResponse> FinishAsync(int id,CancellationToken ct){var x=await store.FindActiveProfessorSessionAsync(id,ct)??throw new UseCaseException("staff.session_closed","Session was already closed.");x.Finish(time.GetUtcNow());await store.SaveChangesAsync(ct);return new(true,id);}
    private static string ValidatePin(string? p){p=(p??"").Trim();if(p.Length!=4||p.Any(c=>!char.IsDigit(c)))throw new UseCaseException("staff.invalid_pin_format","PIN must contain exactly four digits.");return p;}
    private static (string,string) Hash(string p){var salt=RandomNumberGenerator.GetBytes(16);var hash=Rfc2898DeriveBytes.Pbkdf2(p,salt,100000,HashAlgorithmName.SHA256,32);return(Convert.ToHexString(hash),Convert.ToHexString(salt));}
    private static bool Verify(string pin,Professor p){if(string.IsNullOrWhiteSpace(p.PinHash)||string.IsNullOrWhiteSpace(p.PinSalt))return false;var salt=Convert.FromHexString(p.PinSalt);var hash=Rfc2898DeriveBytes.Pbkdf2(pin,salt,100000,HashAlgorithmName.SHA256,32);return CryptographicOperations.FixedTimeEquals(hash,Convert.FromHexString(p.PinHash));}
    private static ProfessorResponse Map(Professor p)=>new(p.Id,p.Name,p.IsActive,!string.IsNullOrWhiteSpace(p.PinHash)&&!string.IsNullOrWhiteSpace(p.PinSalt),p.CreatedAtUtc,p.UpdatedAtUtc);
    private static ProfessorSessionResponse Map(ProfessorSession x)=>new(x.Id,x.ProfessorId,x.ProfessorName,x.LocationId,x.DeviceId,x.StartedAtUtc,x.IsActive?"activa":"cerrada");
}
