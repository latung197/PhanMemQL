using Core.Application.Common.Persistence;

namespace Core.Infrastructure.Common.Persistence;

/// <summary>EF Core transaction shared by EF and <see cref="Sql.SqlExecutor"/> commands.</summary>
public sealed class UnitOfWork(CoreContext db) : IUnitOfWork
{
    // Non-null while this unit of work has a transaction open.
    private List<Action>? _afterCommit;

    public Task ExecuteAsync(Func<CancellationToken, Task> work, CancellationToken ct = default) =>
        ExecuteAsync<object?>(async token => { await work(token); return null; }, ct);

    public async Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> work, CancellationToken ct = default)
    {
        if (db.Database.CurrentTransaction is not null) return await work(ct);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        _afterCommit = [];
        try
        {
            var result = await work(ct);
            await transaction.CommitAsync(ct);
            var actions = _afterCommit;
            _afterCommit = null;
            foreach (var action in actions) action();
            return result;
        }
        finally
        {
            _afterCommit = null;
        }
    }

    public void AfterCommit(Action action)
    {
        if (_afterCommit is null) action();
        else _afterCommit.Add(action);
    }
}
