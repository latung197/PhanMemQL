using System.Collections.Concurrent;
using System.Reflection;

namespace Core.Infrastructure.Common.Persistence.Sql;

/// <summary>
/// Loads SQL files embedded from <c>Modules/{Module}/Sql/{Name}.sql</c>, so long queries live in .sql
/// files next to their module instead of C# strings. Example:
/// <c>SqlScripts.Get("Inventory", "PostReceipt")</c> reads Modules/Inventory/Sql/PostReceipt.sql.
/// </summary>
public static class SqlScripts
{
    private static readonly ConcurrentDictionary<string, string> Cache = new(StringComparer.Ordinal);

    public static string Get(string module, string name) => Get(typeof(SqlScripts).Assembly, module, name);

    public static string Get(Assembly assembly, string module, string name) =>
        Cache.GetOrAdd($"{assembly.GetName().Name}|{module}|{name}", _ =>
        {
            var suffix = $".Modules.{module}.Sql.{name}.sql";
            var resource = assembly.GetManifestResourceNames()
                .FirstOrDefault(x => x.EndsWith(suffix, StringComparison.Ordinal))
                ?? throw new InvalidOperationException($"Không tìm thấy script SQL Modules/{module}/Sql/{name}.sql.");
            using var reader = new StreamReader(assembly.GetManifestResourceStream(resource)!);
            return reader.ReadToEnd();
        });
}
