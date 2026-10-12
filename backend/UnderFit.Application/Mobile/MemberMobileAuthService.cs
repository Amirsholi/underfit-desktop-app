using System.Security.Cryptography;
using UnderFit.Application.Abstractions;
using UnderFit.Application.Common;
using UnderFit.Contracts.Mobile;
using UnderFit.Domain.Members;

namespace UnderFit.Application.Mobile;

public sealed class MemberMobileAuthService(
    IUnderFitDataStore dataStore,
    IMemberTokenIssuer tokenIssuer,
    TimeProvider timeProvider)
{
    private const int PasswordIterations = 210_000;

    public async Task ConfigureAsync(
        string identityNumber,
        ConfigureMemberMobileAccessRequest request,
        CancellationToken cancellationToken)
    {
        ValidatePassword(request.Password);
        var member = await dataStore.FindMemberByIdentityAsync(identityNumber, cancellationToken)
            ?? throw new UseCaseException("member.not_found", "Member not found.");
        if (await dataStore.FindPendingAccountDeletionRequestAsync(
                member.Id,
                cancellationToken) is not null)
        {
            throw new UseCaseException(
                "account_deletion.pending",
                "La cuenta tiene una solicitud de eliminación pendiente.");
        }
        var (hash, salt) = HashNewPassword(request.Password);
        var account = await dataStore.FindMemberMobileAccountAsync(member.Id, cancellationToken);
        if (account is null)
        {
            dataStore.AddMemberMobileAccount(MemberMobileAccount.Create(
                member.Id,
                hash,
                salt,
                timeProvider.GetUtcNow()));
        }
        else
        {
            account.ReplacePassword(hash, salt);
            await RevokeAllAsync(member.Id, timeProvider.GetUtcNow(), cancellationToken);
        }
        await dataStore.SaveChangesAsync(cancellationToken);
    }

    public async Task<MemberMobileSessionResponse> FirstUseAsync(
        MemberMobileFirstUseRequest request,
        CancellationToken cancellationToken)
    {
        ValidatePassword(request.Password);
        var member = await dataStore.FindMemberByIdentityAsync(
            request.IdentityNumber.Trim(),
            cancellationToken)
            ?? throw new UseCaseException(
                "member.not_found",
                "No encontramos un socio con esa cédula.");
        var existing = await dataStore.FindMemberMobileAccountAsync(
            member.Id,
            cancellationToken);
        if (existing is not null)
            throw new UseCaseException(
                "mobile_auth.already_configured",
                "Esta cuenta ya tiene contraseña. Ingresá normalmente o pedí un restablecimiento en Administración.");

        var now = timeProvider.GetUtcNow();
        var (hash, salt) = HashNewPassword(request.Password);
        var account = MemberMobileAccount.Create(member.Id, hash, salt, now);
        dataStore.AddMemberMobileAccount(account);
        await dataStore.SaveChangesAsync(cancellationToken);
        account.RegisterSuccessfulLogin(now);
        return await CreateSessionAsync(member, account, now, cancellationToken);
    }

    public async Task<MemberMobileSessionResponse> ChangePasswordAsync(
        Guid memberId,
        MemberMobileChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        ValidatePassword(request.NewPassword);
        var member = await dataStore.FindMemberByIdAsync(memberId, cancellationToken)
            ?? throw new UseCaseException("member.not_found", "No encontramos al socio.");
        var account = await dataStore.FindMemberMobileAccountAsync(memberId, cancellationToken)
            ?? throw InvalidCredentials();
        var now = timeProvider.GetUtcNow();
        if (!account.IsActive || account.IsLocked(now) ||
            !PasswordMatches(account, request.CurrentPassword))
        {
            account.RegisterFailedLogin(now);
            await dataStore.SaveChangesAsync(cancellationToken);
            throw new UseCaseException(
                "mobile_auth.current_password_invalid",
                "La contraseña actual no es correcta.");
        }

        var (hash, salt) = HashNewPassword(request.NewPassword);
        account.ReplacePassword(hash, salt);
        await RevokeAllAsync(memberId, now, cancellationToken);
        await dataStore.SaveChangesAsync(cancellationToken);
        account.RegisterSuccessfulLogin(now);
        return await CreateSessionAsync(member, account, now, cancellationToken);
    }

    public async Task<MemberMobileSessionResponse> LoginAsync(
        MemberMobileLoginRequest request,
        CancellationToken cancellationToken)
    {
        var member = await dataStore.FindMemberByIdentityAsync(request.IdentityNumber, cancellationToken);
        var account = member is null
            ? null
            : await dataStore.FindMemberMobileAccountAsync(member.Id, cancellationToken);
        var now = timeProvider.GetUtcNow();
        if (member is null || account is null || !account.IsActive || account.IsLocked(now))
        {
            throw InvalidCredentials();
        }

        if (!PasswordMatches(account, request.Password))
        {
            account.RegisterFailedLogin(now);
            await dataStore.SaveChangesAsync(cancellationToken);
            throw InvalidCredentials();
        }

        account.RegisterSuccessfulLogin(now);
        return await CreateSessionAsync(member, account, now, cancellationToken);
    }

    public async Task<MemberMobileSessionResponse> RefreshAsync(
        MemberMobileRefreshRequest request,
        CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        byte[] raw;
        try
        {
            raw = Convert.FromBase64String(request.RefreshToken);
        }
        catch (FormatException)
        {
            throw new UseCaseException("mobile_auth.invalid_refresh", "The session is no longer valid.");
        }
        var hash = SHA256.HashData(raw);
        var existing = await dataStore.FindMemberRefreshTokenAsync(hash, cancellationToken);
        if (existing is null || !existing.IsUsable(now) || !existing.Account.IsActive)
        {
            throw new UseCaseException("mobile_auth.invalid_refresh", "The session is no longer valid.");
        }

        existing.Revoke(now);
        var member = await dataStore.FindMemberByIdAsync(existing.MemberId, cancellationToken)
            ?? throw new UseCaseException("member.not_found", "Member not found.");
        return await CreateSessionAsync(member, existing.Account, now, cancellationToken);
    }

    public async Task LogoutAsync(MemberMobileLogoutRequest request, CancellationToken cancellationToken)
    {
        byte[] raw;
        try
        {
            raw = Convert.FromBase64String(request.RefreshToken);
        }
        catch (FormatException)
        {
            return;
        }
        var existing = await dataStore.FindMemberRefreshTokenAsync(
            SHA256.HashData(raw),
            cancellationToken);
        if (existing is not null)
        {
            existing.Revoke(timeProvider.GetUtcNow());
            await dataStore.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<MemberMobileSessionResponse> CreateSessionAsync(
        Member member,
        MemberMobileAccount account,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var access = tokenIssuer.Issue(member.Id, account.SessionVersion, now);
        var refreshBytes = RandomNumberGenerator.GetBytes(48);
        var refreshExpires = now.AddDays(30);
        dataStore.AddMemberRefreshToken(new MemberRefreshToken(
            Guid.NewGuid(),
            member.Id,
            SHA256.HashData(refreshBytes),
            now,
            refreshExpires));
        await dataStore.SaveChangesAsync(cancellationToken);
        return new MemberMobileSessionResponse(
            access.Value,
            access.ExpiresAtUtc,
            Convert.ToBase64String(refreshBytes),
            refreshExpires,
            Map(member, DateOnly.FromDateTime(timeProvider.GetLocalNow().DateTime)));
    }

    private async Task RevokeAllAsync(
        Guid memberId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        foreach (var token in await dataStore.ListUsableMemberRefreshTokensAsync(
                     memberId,
                     now,
                     cancellationToken))
        {
            token.Revoke(now);
        }
    }

    private static MemberMobileProfileResponse Map(Member member, DateOnly today) =>
        new(
            member.IdentityNumber,
            member.Name,
            member.Email,
            member.Phone,
            member.CurrentMembershipPlan.ToString(),
            member.MembershipExpiresOn,
            member.DaysRemainingOn(today));

    private static (byte[] Hash, byte[] Salt) HashNewPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(24);
        return (
            Rfc2898DeriveBytes.Pbkdf2(
                password,
                salt,
                PasswordIterations,
                HashAlgorithmName.SHA256,
                32),
            salt);
    }

    private static bool PasswordMatches(MemberMobileAccount account, string password)
    {
        var candidate = Rfc2898DeriveBytes.Pbkdf2(
            password,
            account.PasswordSalt,
            PasswordIterations,
            HashAlgorithmName.SHA256,
            account.PasswordHash.Length);
        return CryptographicOperations.FixedTimeEquals(candidate, account.PasswordHash);
    }

    private static void ValidatePassword(string password)
    {
        if (password.Length < 10 || password.Length > 128 ||
            !password.Any(char.IsLetter) || !password.Any(char.IsDigit))
        {
            throw new UseCaseException(
                "mobile_auth.password_invalid",
                "La contraseña debe tener al menos 10 caracteres, una letra y un número.");
        }
    }

    private static UseCaseException InvalidCredentials() =>
        new("mobile_auth.invalid_credentials", "Invalid credentials.");
}
