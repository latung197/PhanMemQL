using Core.Common.Authorization;
using Core.Domain.Modules.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Xunit;

namespace Core.Tests.Common;

public sealed class PermissionPolicyProviderTests
{
    private readonly PermissionPolicyProvider _provider = new(Options.Create(new AuthorizationOptions()));

    [Fact]
    public async Task BuildsPolicyFromAttribute()
    {
        var attribute = new RequirePermissionAttribute("sys_users", PermissionAction.Delete);
        var policy = await _provider.GetPolicyAsync(attribute.Policy!);

        var requirement = Assert.Single(policy!.Requirements.OfType<PermissionRequirement>());
        Assert.Equal("sys_users", requirement.Function);
        Assert.Equal(PermissionAction.Delete, requirement.Action);
        Assert.Single(policy.Requirements.OfType<UnitAccessRequirement>());
    }

    [Fact]
    public async Task RejectsMalformedPermissionPolicy()
    {
        Assert.Null(await _provider.GetPolicyAsync($"{Policies.PermissionPrefix}sys_users:Fly"));
    }
}
