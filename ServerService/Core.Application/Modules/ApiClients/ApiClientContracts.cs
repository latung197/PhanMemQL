namespace Core.Application.Modules.ApiClients;

/// <summary>An API client as listed (never the key itself).</summary>
public sealed record ApiClientDto(
    string Code, string Name, int UserId, string UserName, string UnitCode, string Scope, string KeyPrefix,
    string? AllowedIps, DateTime? ExpiresAt, bool IsActive, DateTime? LastUsedAt, string? LastUsedIp, string? Note,
    DateTime CreatedAt, uint Version);

/// <summary>New client: <c>RoleId</c> is the role its service account gets (the rights the key has) in <c>UnitCode</c>.</summary>
public sealed record CreateApiClientRequest(
    string Code, string Name, string RoleId, string UnitCode, string? Scope, string? AllowedIps, DateTime? ExpiresAt, string? Note);

public sealed record UpdateApiClientRequest(
    string Name, string? AllowedIps, DateTime? ExpiresAt, bool IsActive, string? Note);

/// <summary>The only moment the key is visible: when the client is created or its key is replaced.</summary>
public sealed record ApiClientKeyDto(ApiClientDto Client, string ApiKey);

/// <summary>Who a valid key acts as.</summary>
public sealed record ApiKeyIdentity(string ClientCode, int UserId, string UserName, string UnitCode, string Scope, int SecurityVersion);

public enum ApiKeyFailure { None, Unknown, Inactive, Expired, AddressDenied, AccountUnavailable }

public interface IApiClientService
{
    Task<IReadOnlyList<ApiClientDto>> GetAllAsync(CancellationToken ct);
    Task<ApiClientKeyDto> CreateAsync(int actorUserId, CreateApiClientRequest request, CancellationToken ct);
    Task<ApiClientDto> UpdateAsync(int actorUserId, string code, UpdateApiClientRequest request, CancellationToken ct);
    /// <summary>Replaces the key: the old one stops working at once.</summary>
    Task<ApiClientKeyDto> RotateKeyAsync(int actorUserId, string code, CancellationToken ct);
    /// <summary>Deletes the client and switches its service account off.</summary>
    Task DeleteAsync(int actorUserId, string code, CancellationToken ct);

    /// <summary>Checks a key for a request from <paramref name="ip"/>; on success the identity to act as, and the use is recorded.</summary>
    Task<(ApiKeyIdentity? Identity, ApiKeyFailure Failure)> ValidateAsync(string key, string? ip, CancellationToken ct);
}

/// <summary>The outcome of starting a request that carries an Idempotency-Key.</summary>
public enum IdempotencyStart { Started, Replay, DifferentRequest, Busy }

public sealed record StoredReply(int Status, string? ContentType, string? Body);

/// <summary>Replies kept per client and Idempotency-Key, so a request sent again (the network dropped the answer) does the work once.</summary>
public interface IIdempotencyStore
{
    Task<(IdempotencyStart Result, StoredReply? Reply)> BeginAsync(string clientCode, string key, string requestHash, CancellationToken ct);
    Task CompleteAsync(string clientCode, string key, StoredReply reply, CancellationToken ct);
    /// <summary>The request failed before a reply existed: free the key so the retry can run.</summary>
    Task AbandonAsync(string clientCode, string key, CancellationToken ct);
}
