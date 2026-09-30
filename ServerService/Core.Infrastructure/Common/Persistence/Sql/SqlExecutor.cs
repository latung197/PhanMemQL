using System.Data;
using System.Data.Common;
using Core.Application.Common.Persistence;
using Dapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Core.Infrastructure.Common.Persistence.Sql;

/// <summary>Dapper on the EF Core connection, enlisted in the EF transaction when one is open.</summary>
public sealed class SqlExecutor(CoreContext db) : ISqlExecutor
{
    static SqlExecutor()
    {
        // Map snake_case columns (ma_vt) to PascalCase properties (MaVt).
        DefaultTypeMap.MatchNamesWithUnderscores = true;
    }

    public async Task<IReadOnlyList<T>> QueryAsync<T>(string sql, object? parameters = null,
        CancellationToken ct = default) =>
        (await (await OpenAsync(ct)).QueryAsync<T>(Command(sql, parameters, ct))).AsList();

    public async Task<T?> QuerySingleOrDefaultAsync<T>(string sql, object? parameters = null,
        CancellationToken ct = default) =>
        await (await OpenAsync(ct)).QuerySingleOrDefaultAsync<T>(Command(sql, parameters, ct));

    public async Task<T?> ExecuteScalarAsync<T>(string sql, object? parameters = null,
        CancellationToken ct = default) =>
        await (await OpenAsync(ct)).ExecuteScalarAsync<T>(Command(sql, parameters, ct));

    public async Task<int> ExecuteAsync(string sql, object? parameters = null, CancellationToken ct = default) =>
        await (await OpenAsync(ct)).ExecuteAsync(Command(sql, parameters, ct));

    private CommandDefinition Command(string sql, object? parameters, CancellationToken ct) =>
        new(sql, parameters, db.Database.CurrentTransaction?.GetDbTransaction(), cancellationToken: ct);

    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await db.Database.OpenConnectionAsync(ct);
        return connection;
    }
}
