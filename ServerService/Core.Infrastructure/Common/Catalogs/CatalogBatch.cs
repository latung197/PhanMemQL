using Core.Application.Common.Localization;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Persistence;
using Core.Infrastructure.Common.Persistence;

namespace Core.Infrastructure.Common.Catalogs;

/// <summary>
/// Excel import and bulk delete for every catalog, written once. The catalog passes its own CreateAsync / UpdateAsync /
/// DeleteAsync, so each row goes through exactly the checks of the form (and the change log, record stamps, cache
/// invalidation). All in one transaction: each row runs under a savepoint, so a refused row does not break the
/// following ones and every error is reported; at the end, any error rolls everything back.
/// </summary>
public sealed class CatalogBatch(CoreContext db, IUnitOfWork unitOfWork)
{
    private sealed class Failed(List<RowError> errors) : Exception
    {
        public List<RowError> Errors { get; } = errors;
    }

    public async Task<ImportResult> ImportAsync<TRequest>(ImportRequest<TRequest> request, Func<TRequest, string> keyOf,
        Func<string, CancellationToken, Task<bool>> exists, Func<TRequest, CancellationToken, Task> create,
        Func<string, TRequest, CancellationToken, Task> update, CancellationToken ct)
    {
        var rows = request.Rows ?? [];
        if (rows.Count == 0) throw new BusinessRuleException("import.empty");
        if (rows.Count > CatalogBatchLimits.MaxRows) throw new BusinessRuleException("import.tooMany", CatalogBatchLimits.MaxRows);

        int created = 0, updated = 0;
        try
        {
            await unitOfWork.ExecuteAsync(async token =>
            {
                var errors = new List<RowError>();
                var seen = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                for (var i = 0; i < rows.Count && errors.Count < CatalogBatchLimits.MaxErrors; i++)
                {
                    var row = i + 1;
                    var key = (keyOf(rows[i]) ?? string.Empty).Trim();
                    if (key.Length > 0 && seen.TryGetValue(key, out var first))
                    {
                        errors.Add(new RowError(row, Messages.T("import.duplicateInFile", key, first)));
                        continue;
                    }
                    if (key.Length > 0) seen[key] = row;
                    var error = await RunAsync(async () =>
                    {
                        if (key.Length > 0 && await exists(key, token))
                        {
                            if (!request.IsUpsert) throw new BusinessRuleException("import.exists", key);
                            await update(key, rows[i], token);
                            updated++;
                        }
                        else
                        {
                            await create(rows[i], token);
                            created++;
                        }
                    }, token);
                    if (error is not null) errors.Add(new RowError(row, error));
                }
                if (errors.Count > 0) throw new Failed(errors);
            }, ct);
        }
        catch (Failed failed)
        {
            db.ChangeTracker.Clear();
            return new ImportResult(0, 0, failed.Errors);
        }
        return new ImportResult(created, updated, []);
    }

    public async Task<DeleteManyResult> DeleteManyAsync(DeleteManyRequest request, Func<string, CancellationToken, Task> delete,
        CancellationToken ct)
    {
        var keys = (request.Keys ?? []).Where(k => !string.IsNullOrWhiteSpace(k)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (keys.Count == 0) throw new BusinessRuleException("import.nothingSelected");
        if (keys.Count > CatalogBatchLimits.MaxRows) throw new BusinessRuleException("import.tooMany", CatalogBatchLimits.MaxRows);
        try
        {
            await unitOfWork.ExecuteAsync(async token =>
            {
                var errors = new List<RowError>();
                for (var i = 0; i < keys.Count && errors.Count < CatalogBatchLimits.MaxErrors; i++)
                {
                    var key = keys[i];
                    var error = await RunAsync(() => delete(key, token), token);
                    if (error is not null) errors.Add(new RowError(i + 1, $"{key}: {error}"));
                }
                if (errors.Count > 0) throw new Failed(errors);
            }, ct);
        }
        catch (Failed failed)
        {
            db.ChangeTracker.Clear();
            return new DeleteManyResult(0, failed.Errors);
        }
        return new DeleteManyResult(keys.Count, []);
    }

    /// <summary>Runs one row under a savepoint; returns the user message when the row is refused.</summary>
    private async Task<string?> RunAsync(Func<Task> work, CancellationToken ct)
    {
        var transaction = db.Database.CurrentTransaction!;
        await transaction.CreateSavepointAsync("catalog_row", ct);
        try
        {
            await work();
            await transaction.ReleaseSavepointAsync("catalog_row", ct);
            return null;
        }
        catch (Exception ex) when ((ex as AppException ?? DatabaseErrors.Translate(ex)) is { } error)
        {
            await transaction.RollbackToSavepointAsync("catalog_row", ct);
            // The refused entity is still tracked; forget everything (saved rows are already in the transaction).
            db.ChangeTracker.Clear();
            return error.Message;
        }
    }
}
