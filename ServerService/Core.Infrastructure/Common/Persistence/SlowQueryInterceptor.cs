using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Core.Infrastructure.Common.Persistence;

/// <summary>
/// Logs a warning for every SQL command of CoreContext slower than Monitoring:SlowQueryMs (default 500 ms), with its
/// text (parameter values are not logged) and duration: the first place to look when a screen gets slow. For the
/// whole database, enable pg_stat_statements on the server.
/// </summary>
public sealed class SlowQueryInterceptor(IConfiguration configuration, ILogger<SlowQueryInterceptor> logger) : DbCommandInterceptor
{
    private readonly TimeSpan _threshold = TimeSpan.FromMilliseconds(configuration.GetValue("Monitoring:SlowQueryMs", 500));
    private const int MaxSqlLength = 2000;

    private void Check(DbCommand command, CommandExecutedEventData eventData)
    {
        if (eventData.Duration < _threshold) return;
        var sql = command.CommandText.Length > MaxSqlLength ? command.CommandText[..MaxSqlLength] + "…" : command.CommandText;
        logger.LogWarning("Câu SQL chậm ({Elapsed:0} ms): {Sql}", eventData.Duration.TotalMilliseconds, sql);
    }

    public override DbDataReader ReaderExecuted(DbCommand command, CommandExecutedEventData eventData, DbDataReader result)
    {
        Check(command, eventData);
        return result;
    }

    public override ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
        DbDataReader result, CancellationToken cancellationToken = default)
    {
        Check(command, eventData);
        return ValueTask.FromResult(result);
    }

    public override int NonQueryExecuted(DbCommand command, CommandExecutedEventData eventData, int result)
    {
        Check(command, eventData);
        return result;
    }

    public override ValueTask<int> NonQueryExecutedAsync(DbCommand command, CommandExecutedEventData eventData, int result,
        CancellationToken cancellationToken = default)
    {
        Check(command, eventData);
        return ValueTask.FromResult(result);
    }

    public override object? ScalarExecuted(DbCommand command, CommandExecutedEventData eventData, object? result)
    {
        Check(command, eventData);
        return result;
    }

    public override ValueTask<object?> ScalarExecutedAsync(DbCommand command, CommandExecutedEventData eventData, object? result,
        CancellationToken cancellationToken = default)
    {
        Check(command, eventData);
        return ValueTask.FromResult(result);
    }
}
