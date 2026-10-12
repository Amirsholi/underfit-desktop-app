using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using UnderFit.Application.Abstractions;

namespace UnderFit.Api.Security;

public sealed class MemberJwtTokenIssuer(IConfiguration configuration) : IMemberTokenIssuer
{
    public IssuedMemberAccessToken Issue(Guid memberId, int sessionVersion, DateTimeOffset now)
    {
        var key = configuration["Authentication:JwtKey"]
            ?? throw new InvalidOperationException("Authentication:JwtKey is required.");
        if (Encoding.UTF8.GetByteCount(key) < 32)
        {
            throw new InvalidOperationException("Authentication:JwtKey must contain at least 32 bytes.");
        }

        var expires = now.AddMinutes(15);
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: "underfit-api",
            audience: "underfit-mobile",
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Sub, memberId.ToString()),
                new Claim(ClaimTypes.Role, "Member"),
                new Claim("session_version", sessionVersion.ToString())
            ],
            notBefore: now.UtcDateTime,
            expires: expires.UtcDateTime,
            signingCredentials: credentials);
        return new IssuedMemberAccessToken(
            new JwtSecurityTokenHandler().WriteToken(token),
            expires);
    }
}
