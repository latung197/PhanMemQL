using System.Data.Common;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using Core.Application.Common.Caching;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Core.Infrastructure.Common.Caching;

/// <summary>
/// Keeps IAppCache in step with the database without services having to remember it: every command CoreContext runs
/// is scanned for INSERT INTO / UPDATE / DELETE FROM, and the tables it writes are invalidated right away and again
/// when the surrounding transaction commits (a request that read the old rows in between cannot keep them cached).
/// </summary>
public sealed partial class CacheInvalidationInterceptor(IAppCache cache) : DbCommandInterceptor, IDbTransactionInterceptor
{
    /// <summary>Tables written inside the open transaction of each context.</summary>
    private readonly ConditionalWeakTable<DbContext, HashSet<string>> _pending = new();

    [GeneratedRegex(@"\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:""?\w+""?\.)?""?(\w+)""?", RegexOptions.IgnoreCase)]
    private static partial Regex WrittenTable();

    /// <summary>Tables a SQL text writes to (for tests too).</summary>
    public static IReadOnlyCollection<string> TablesWritten(string sql) =>
        WrittenTable().Matches(sql).Select(m => m.Groups[1].Value.ToLowerInvariant()).Distinct().ToList();

    private void Written(DbCommand command, DbContext? context)
    {
        var tables = TablesWritten(command.CommandText);
        if (tables.Count == 0) return;
        cache.InvalidateTables(tables);
        if (context?.Database.CurrentTransaction is null) return;
        var pending = _pending.GetOrCreateValue(context);
        lock (pending) pending.UnionWith(tables);
    }

    private void Committed(DbContext? context)
    {
        if (context is null || !_pending.TryGetValue(context, out var pending)) return;
        string[] tables;
        lock (pending)
        {
            tables = [.. pending];
            pending.Clear();
        }
        cache.InvalidateTables(tables);
    }

    public override int NonQueryExecuted(DbCommand command, CommandExecutedEventData eventData, int result)
    {
        Written(command, eventData.Context);
        return result;
    }

    public override ValueTask<int> NonQueryExecutedAsync(DbCommand command, CommandExecutedEventData eventData, int result,
        CancellationToken cancellationToken = default)
    {
        Written(command, eventData.Context);
        return ValueTask.FromResult(result);
    }

    public override DbDataReader ReaderExecuted(DbCommand command, CommandExecutedEventData eventData, DbDataReader result)
    {
        Written(command, eventData.Context);
        return result;
    }

    public override ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
        DbDataReader result, CancellationToken cancellationToken = default)
    {
        Written(command, eventData.Context);
        return ValueTask.FromResult(result);
    }

    public void TransactionCommitted(DbTransaction transaction, TransactionEndEventData eventData) => Committed(eventData.Context);

    public Task TransactionCommittedAsync(DbTransaction transaction, TransactionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        Committed(eventData.Context);
        return Task.CompletedTask;
    }

    // A rollback also drops what was cached meanwhile (it may hold rows that never existed).
    public void TransactionRolledBack(DbTransaction transaction, TransactionEndEventData eventData) => Committed(eventData.Context);

    public Task TransactionRolledBackAsync(DbTransaction transaction, TransactionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        Committed(eventData.Context);
        return Task.CompletedTask;
    }
}
