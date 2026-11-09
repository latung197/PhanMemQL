using Core.Application.Modules.Users;
using Core.Domain.Modules.Users;

namespace Core.Tests.Common;

/// <summary>A permission service for tests: an administrator, or a user who may View the given functions and work in the given units.</summary>
public sealed class FakePermissions(bool admin = false, IEnumerable<string>? views = null, IEnumerable<string>? units = null) : IPermissionService
{
    private readonly HashSet<string> _views = [.. views ?? []];
    private readonly HashSet<string> _units = [.. units ?? []];

    public Task<bool> IsAdminAsync(int userId, CancellationToken ct = default) => Task.FromResult(admin);
    public Task<bool> IsTokenCurrentAsync(int userId, int securityVersion, CancellationToken ct = default) => Task.FromResult(true);
    public Task<IReadOnlyDictionary<string, ActionPermissions>> GetEffectiveInUnitAsync(int userId, string? unitCode, CancellationToken ct = default) =>
        GetEffectiveAsync(userId, ct);

    public Task<IReadOnlySet<string>> GetRightsInUnitAsync(int userId, string? unitCode, CancellationToken ct = default) =>
        GetRightsAsync(userId, ct);

    public Task<IReadOnlySet<string>?> VisibleUnitsAsync(int userId, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlySet<string>?>(admin ? null : _units.ToHashSet());

    public Task<bool> HasUnitAccessAsync(int userId, string unitCode, CancellationToken ct = default) => Task.FromResult(admin || _units.Contains(unitCode));

    public Task<IReadOnlyDictionary<string, ActionPermissions>> GetEffectiveAsync(int userId, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyDictionary<string, ActionPermissions>>(
            _views.ToDictionary(x => x, _ => new ActionPermissions(true, false, false, false, false, false, false)));

    public Task<IReadOnlyDictionary<int, IReadOnlyDictionary<string, ActionPermissions>>> GetEffectiveManyAsync(IReadOnlyCollection<int> userIds, string? unitCode, CancellationToken ct = default) =>
        throw new NotSupportedException();

    public Task<IReadOnlySet<string>> GetRightsAsync(int userId, CancellationToken ct = default) => Task.FromResult<IReadOnlySet<string>>(new HashSet<string>());
    public Task<bool> HasRightAsync(int userId, string function, string rightCode, CancellationToken ct = default) => Task.FromResult(admin);
    public Task EnsureAllowedAsync(int userId, string function, PermissionAction action, CancellationToken ct = default) => Task.CompletedTask;
    public Task EnsureAnyAllowedAsync(int userId, string function, IReadOnlyCollection<PermissionAction> actions, CancellationToken ct = default) => Task.CompletedTask;
    public Task EnsureAdminAsync(int userId, CancellationToken ct = default) => Task.CompletedTask;
    public void Forget(int userId) { }
}
