using Core.Domain.Modules.Users;
using Xunit;

namespace Core.Tests.Modules.Users;

public sealed class CommandPermissionTests
{
    [Fact]
    public void FiveActionsRoundTripThroughLegacyFlags()
    {
        var actions = new ActionPermissions(true, true, false, true, false);
        var row = new SysUserCommand();
        row.SetActions(actions);

        Assert.True(row.CanView && row.CanSearch && row.CanAdd && row.CanEdit && row.CanApprove);
        Assert.False(row.CanDelete || row.CanPrint || row.CanExport);
        Assert.Equal(actions, row.ToActions());
    }

    [Fact]
    public void LegacyRowWithOnlyExportCountsAsPrintExport()
    {
        var row = new SysRoleCommand { CanExport = true };
        Assert.Equal(new ActionPermissions(false, false, false, false, true), row.ToActions());
    }
}
