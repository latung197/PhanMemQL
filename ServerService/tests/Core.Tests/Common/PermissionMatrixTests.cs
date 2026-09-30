using Core.Application.Common.Exceptions;
using Core.Application.Common.Permissions;
using Core.Domain.Modules.Users;
using Xunit;

namespace Core.Tests.Common;

public sealed class PermissionMatrixTests
{
    private static readonly ActionPermissions ViewOnly = new(true, false, false, false, false);
    private static readonly ActionPermissions EditOnly = new(false, true, false, false, false);

    [Fact]
    public void AdminGetsFullRightsForEveryFunction()
    {
        var matrix = PermissionMatrix.Resolve(true, [], []);
        Assert.Equal(FunctionCatalog.Functions.Count, matrix.Count);
        Assert.All(matrix.Values, actions => Assert.Equal(ActionPermissions.Full, actions));
    }

    [Fact]
    public void OwnMatrixReplacesRoleMatrix()
    {
        var matrix = PermissionMatrix.Resolve(false, [("sys_users", ViewOnly)], [("sys_users", EditOnly), ("hr_list", EditOnly)]);
        Assert.Equal(ViewOnly, matrix["sys_users"]);
        Assert.Equal(ActionPermissions.None, matrix["hr_list"]);
    }

    [Fact]
    public void RolesAreCombinedWhenUserHasNoOwnMatrix()
    {
        var matrix = PermissionMatrix.Resolve(false, [], [("sys_users", ViewOnly), ("sys_users", EditOnly)]);
        Assert.Equal(new ActionPermissions(true, true, false, false, false), matrix["sys_users"]);
        Assert.Equal(ActionPermissions.None, matrix["overview_main"]);
    }

    [Fact]
    public void UnknownFunctionCodesAreRejected()
    {
        Assert.Throws<BusinessRuleException>(() => PermissionMatrix.EnsureKnownCodes(
            new Dictionary<string, ActionPermissions> { ["not_a_function"] = ViewOnly }));
        PermissionMatrix.EnsureKnownCodes(new Dictionary<string, ActionPermissions> { ["sys_users"] = ViewOnly });
    }

    [Fact]
    public void FunctionCodesFitTheDatabaseColumn()
    {
        Assert.All(FunctionCatalog.Functions.Keys, code => Assert.InRange(code.Length, 1, 64));
    }
}
