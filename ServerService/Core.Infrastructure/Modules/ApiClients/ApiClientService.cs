using Core.Application.Common.Exceptions;
using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.ApiClients;
using Core.Application.Modules.Users;
using Core.Domain.Modules.ApiClients;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.ApiClients;

/// <summary>
/// API clients (docs/he-thong/tich-hop-api-key.md): a machine that calls the API with a key. Each client has a service account made
/// through <see cref="IUserService"/> (so every grant check of an ordinary account applies to whoever creates it), and the key is
/// kept only as a hash. Only the super administrator reaches these methods (policy of the controller).
/// </summary>
public sealed class ApiClientService(CoreContext db, IUserService users, IPermissionService permissions, IUnitOfWork unitOfWork)
    : IApiClientService
{
    private const string AccountPrefix = "api-";

    public async Task<IReadOnlyList<ApiClientDto>> GetAllAsync(CancellationToken ct)
    {
        var rows = await db.ApiClients.AsNoTracking().OrderBy(x => x.Code).ToListAsync(ct);
        var names = await UserNamesAsync(rows, ct);
        return rows.Select(x => ToDto(x, names)).ToList();
    }

    public async Task<ApiClientKeyDto> CreateAsync(int actorUserId, CreateApiClientRequest request, CancellationToken ct)
    {
        var code = Guard.Code(request.Code, 30, "field.apiClientCode");
        var name = Guard.Required(request.Name, 200, "field.apiClientName");
        var unit = Guard.Code(request.UnitCode, 20, "field.unitCode");
        var scope = (Guard.Optional(request.Scope, 20, "field.scope") ?? ApiKeyScopes.Transfer).ToUpperInvariant();
        if (!ApiKeyScopes.All.Contains(scope)) throw new BusinessRuleException("apiClient.scope", scope);
        var ips = Guard.Optional(request.AllowedIps, 500, "field.allowedIps");
        if (!ApiKeyRules.IsValidIpList(ips)) throw new BusinessRuleException("apiClient.badIps");
        if (request.ExpiresAt is { } expires && expires <= DateTime.UtcNow) throw new BusinessRuleException("apiClient.expiryPast");
        if (string.IsNullOrWhiteSpace(request.RoleId)) throw new BusinessRuleException("apiClient.roleRequired");
        if (await db.ApiClients.AnyAsync(x => x.Code == code, ct)) throw new BusinessRuleException("apiClient.codeUsed");

        var (key, prefix) = ApiKeyRules.Generate();
        var username = AccountPrefix + code.ToLowerInvariant();
        // The account is made like any other (role, unit and the checks that the creator may grant those rights), then flagged.
        var client = await unitOfWork.ExecuteAsync(async token =>
        {
            var profile = await users.CreateAsync(actorUserId, new CreateUserRequest(
                username, ApiKeyRules.RandomPassword(), name, null, null, null, null, null,
                request.RoleId, unit, [unit], null), token);
            var accountId = int.Parse(profile.Id, System.Globalization.CultureInfo.InvariantCulture);
            var account = await db.Users.FirstAsync(x => x.UserId == accountId, token);
            account.IsServiceAccount = true;
            account.MustChangePassword = false;
            account.PasswordChangedAt = null;
            var row = new ApiClient
            {
                Code = code, Name = name, UserId = account.UserId, UnitCode = unit, Scope = scope,
                KeyPrefix = prefix, KeyHash = ApiKeyRules.Hash(key), AllowedIps = ips, ExpiresAt = request.ExpiresAt,
                Note = Guard.Optional(request.Note, 300, "field.note")
            };
            db.ApiClients.Add(row);
            await db.SaveChangesAsync(token);
            return row;
        }, ct);
        return new ApiClientKeyDto(ToDto(client, new Dictionary<int, string> { [client.UserId] = username }), key);
    }

    public async Task<ApiClientDto> UpdateAsync(int actorUserId, string code, UpdateApiClientRequest request, CancellationToken ct)
    {
        // No version check here (ConcurrencyContractTests exemption): every call of the key writes last_used_at on this row, which
        // moves xmin, so a form open for a minute would always be refused as stale. Only the super administrator edits it.
        var row = await FindAsync(code, ct);
        var ips = Guard.Optional(request.AllowedIps, 500, "field.allowedIps");
        if (!ApiKeyRules.IsValidIpList(ips)) throw new BusinessRuleException("apiClient.badIps");
        row.Name = Guard.Required(request.Name, 200, "field.apiClientName");
        row.AllowedIps = ips;
        row.ExpiresAt = request.ExpiresAt;
        row.IsActive = request.IsActive;
        row.Note = Guard.Optional(request.Note, 300, "field.note");
        await db.SaveChangesAsync(ct);
        return ToDto(row, await UserNamesAsync([row], ct));
    }

    public async Task<ApiClientKeyDto> RotateKeyAsync(int actorUserId, string code, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        var (key, prefix) = ApiKeyRules.Generate();
        row.KeyPrefix = prefix;
        row.KeyHash = ApiKeyRules.Hash(key);
        await db.SaveChangesAsync(ct);
        return new ApiClientKeyDto(ToDto(row, await UserNamesAsync([row], ct)), key);
    }

    public async Task DeleteAsync(int actorUserId, string code, CancellationToken ct)
    {
        var row = await FindAsync(code, ct);
        await unitOfWork.ExecuteAsync(async token =>
        {
            // The account stays (vouchers it made keep their "created by") but is switched off for good and renamed, so the
            // code of the deleted client can be used again.
            var account = await db.Users.FirstOrDefaultAsync(x => x.UserId == row.UserId, token);
            if (account is { IsServiceAccount: true })
            {
                account.UserName = $"deleted-{account.UserId}-{row.Code.ToLowerInvariant()}";
                account.IsActive = false;
                account.ValidFlg = 0;
                account.SecurityVersion++;
            }
            db.ApiClients.Remove(row);
            await db.SaveChangesAsync(token);
        }, ct);
    }

    public async Task<(ApiKeyIdentity? Identity, ApiKeyFailure Failure)> ValidateAsync(string key, string? ip, CancellationToken ct)
    {
        if (!ApiKeyRules.LooksLikeKey(key)) return (null, ApiKeyFailure.Unknown);
        var hash = ApiKeyRules.Hash(key);
        var client = await db.ApiClients.AsNoTracking().FirstOrDefaultAsync(x => x.KeyHash == hash, ct);
        if (client is null) return (null, ApiKeyFailure.Unknown);
        if (!client.IsActive) return (null, ApiKeyFailure.Inactive);
        if (client.ExpiresAt is { } expires && expires <= DateTime.UtcNow) return (null, ApiKeyFailure.Expired);
        if (!ApiKeyRules.IpAllowed(client.AllowedIps, ip)) return (null, ApiKeyFailure.AddressDenied);

        var account = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == client.UserId, ct);
        if (account is not { IsServiceAccount: true, CanSignIn: true }
            || !await permissions.HasUnitAccessAsync(account.UserId, client.UnitCode, ct))
            return (null, ApiKeyFailure.AccountUnavailable);

        // The use is noted at most once a minute: the key is checked on every call.
        var now = DateTime.UtcNow;
        if (client.LastUsedAt is null || now - client.LastUsedAt > TimeSpan.FromMinutes(1))
            await db.ApiClients.Where(x => x.Code == client.Code)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.LastUsedAt, now).SetProperty(x => x.LastUsedIp, ip), ct);

        return (new ApiKeyIdentity(client.Code, account.UserId, account.UserName, client.UnitCode, client.Scope, account.SecurityVersion),
            ApiKeyFailure.None);
    }

    private async Task<ApiClient> FindAsync(string code, CancellationToken ct) =>
        await db.ApiClients.FirstOrDefaultAsync(x => x.Code == code.Trim().ToUpperInvariant(), ct)
        ?? throw new NotFoundException("apiClient.notFound");

    private async Task<Dictionary<int, string>> UserNamesAsync(IEnumerable<ApiClient> rows, CancellationToken ct)
    {
        var ids = rows.Select(x => x.UserId).Distinct().ToList();
        return await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId)).ToDictionaryAsync(x => x.UserId, x => x.UserName, ct);
    }

    private static ApiClientDto ToDto(ApiClient x, IReadOnlyDictionary<int, string> names) => new(
        x.Code, x.Name, x.UserId, names.GetValueOrDefault(x.UserId, string.Empty), x.UnitCode, x.Scope, x.KeyPrefix,
        x.AllowedIps, x.ExpiresAt, x.IsActive, x.LastUsedAt, x.LastUsedIp, x.Note, x.CreatedAt, x.Version);
}
