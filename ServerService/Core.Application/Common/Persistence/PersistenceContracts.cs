namespace Core.Application.Common.Persistence;

/// <summary>
/// Plain SQL for reports, calculations and ledger posting, where speed matters more than change
/// tracking. CRUD stays on EF Core. Commands run on the same PostgreSQL connection and inside the same
/// transaction as EF, so "save voucher (EF) + post to ledgers (SQL)" is atomic when wrapped in
/// <see cref="IUnitOfWork"/>. Always pass values as parameters (@name), never by string concatenation.
/// </summary>
public interface ISqlExecutor
{
    Task<IReadOnlyList<T>> QueryAsync<T>(string sql, object? parameters = null, CancellationToken ct = default);
    Task<T?> QuerySingleOrDefaultAsync<T>(string sql, object? parameters = null, CancellationToken ct = default);
    Task<T?> ExecuteScalarAsync<T>(string sql, object? parameters = null, CancellationToken ct = default);

    /// <returns>Number of affected rows.</returns>
    Task<int> ExecuteAsync(string sql, object? parameters = null, CancellationToken ct = default);
}

/// <summary>Runs work in one database transaction (joins the current one if already started).</summary>
public interface IUnitOfWork
{
    Task ExecuteAsync(Func<CancellationToken, Task> work, CancellationToken ct = default);
    Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> work, CancellationToken ct = default);
}
