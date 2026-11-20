using Core.Application.Common.Persistence;
using Core.Application.Modules.ApiClients;

namespace Core.Infrastructure.Modules.ApiClients;

/// <summary>
/// Replies kept in <c>sys_idempotency_key</c> (SQL only, no entity). The first request of a key inserts a "running" row (the unique
/// index makes two simultaneous requests of the same key meet here), the reply is stored when it is done, and a failed request
/// frees the key. Rows older than a week are purged now and then.
/// </summary>
public sealed class IdempotencyStore(ISqlExecutor sql) : IIdempotencyStore
{
    private sealed record Row(short State, string RequestHash, short? ResponseStatus, string? ResponseType, string? ResponseBody);

    public async Task<(IdempotencyStart Result, StoredReply? Reply)> BeginAsync(
        string clientCode, string key, string requestHash, CancellationToken ct)
    {
        await sql.ExecuteAsync("DELETE FROM sys_idempotency_key WHERE created_at < now() - interval '7 days' AND random() < 0.01", null, ct);
        var inserted = await sql.ExecuteAsync(
            "INSERT INTO sys_idempotency_key (client_code, key, request_hash) VALUES (@clientCode, @key, @requestHash) ON CONFLICT DO NOTHING",
            new { clientCode, key, requestHash }, ct);
        if (inserted == 1) return (IdempotencyStart.Started, null);

        var row = await sql.QuerySingleOrDefaultAsync<Row>(
            "SELECT state, request_hash, response_status, response_type, response_body FROM sys_idempotency_key WHERE client_code = @clientCode AND key = @key",
            new { clientCode, key }, ct);
        if (row is null) return (IdempotencyStart.Busy, null);
        if (!string.Equals(row.RequestHash, requestHash, StringComparison.Ordinal)) return (IdempotencyStart.DifferentRequest, null);
        return row.State == 1 && row.ResponseStatus is { } status
            ? (IdempotencyStart.Replay, new StoredReply(status, row.ResponseType, row.ResponseBody))
            : (IdempotencyStart.Busy, null);
    }

    public Task CompleteAsync(string clientCode, string key, StoredReply reply, CancellationToken ct) => sql.ExecuteAsync(
        "UPDATE sys_idempotency_key SET state = 1, response_status = @status, response_type = @type, response_body = @body WHERE client_code = @clientCode AND key = @key",
        new { clientCode, key, status = (short)reply.Status, type = reply.ContentType, body = reply.Body }, ct);

    public Task AbandonAsync(string clientCode, string key, CancellationToken ct) => sql.ExecuteAsync(
        "DELETE FROM sys_idempotency_key WHERE client_code = @clientCode AND key = @key AND state = 0", new { clientCode, key }, ct);
}
