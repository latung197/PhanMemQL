namespace Core.Application.Common.Caching;

/// <summary>
/// Shared cache for data read on almost every request (a user's access, settings, small catalogs). Each entry names
/// the tables it was read from and is dropped as soon as anything writes to one of them: CoreContext reports every
/// INSERT / UPDATE / DELETE it runs (SaveChanges, ExecuteUpdate / ExecuteDelete, raw SQL through EF), again when the
/// transaction commits. An entry also expires after its time to live, as a safety net.
/// <para>
/// Only for data that is the same for everyone who asks (or keyed by user). Never cache stock, balances, voucher
/// numbers or month locks: those are read in the transaction that uses them. Writes made outside EF (Dapper through
/// ISqlExecutor) must call <see cref="InvalidateTables"/> themselves.
/// </para>
/// The cache is in the memory of one API instance; running several instances needs a shared invalidation signal
/// (PostgreSQL LISTEN / NOTIFY or Redis) before relying on it.
/// </summary>
public interface IAppCache
{
    Task<T> GetOrCreateAsync<T>(string key, IReadOnlyCollection<string> tables, Func<CancellationToken, Task<T>> factory,
        CancellationToken ct, TimeSpan? timeToLive = null);

    /// <summary>Drops every entry read from one of these tables.</summary>
    void InvalidateTables(IEnumerable<string> tables);

    void Remove(string key);
}

/// <summary>Table names used as cache dependencies (same as the [Table] names of the entities).</summary>
public static class CacheTables
{
    /// <summary>Everything a user's access depends on (account, roles, permission rows, units).</summary>
    public static readonly IReadOnlyCollection<string> UserAccess =
    [
        "sys_users", "sys_user_role", "sys_role", "sys_user_command", "sys_role_command", "sys_user_right",
        "sys_role_right", "sys_user_company_unit", "sys_company_unit"
    ];
}
