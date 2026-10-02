using Core.Domain.Modules.Users;
using System.Text.Json;
using Xunit;

namespace Core.Tests.Modules.Users;

public sealed class CommandPermissionTests
{
    [Fact]
    public void SevenActionsRoundTripThroughLegacyFlags()
    {
        var actions = new ActionPermissions(true, true, false, false, true, false, true);
        var row = new SysUserCommand();
        row.SetActions(actions);

        Assert.True(row.CanView && row.CanSearch && row.CanAdd && row.CanCopy && row.CanImport && row.CanApprove && row.CanExport);
        Assert.False(row.CanEdit || row.CanDelete || row.CanPrint);
        Assert.Equal(actions, row.ToActions());
    }

    [Fact]
    public void AddAndEditAreSeparateFlags()
    {
        Assert.Equal(new ActionPermissions(false, false, true, false, false, false, false), new SysRoleCommand { CanEdit = true }.ToActions());
        Assert.Equal(new ActionPermissions(false, false, false, false, false, true, false), new SysRoleCommand { CanPrint = true }.ToActions());
    }

    [Fact]
    public void JsonUsesTheSevenActions()
    {
        var json = JsonSerializer.Serialize(new ActionPermissions(true, true, false, false, false, true, false));
        Assert.Equal("{\"view\":true,\"create\":true,\"edit\":false,\"delete\":false,\"approve\":false,\"print\":true,\"export\":false}", json);
        Assert.Equal(new ActionPermissions(true, true, false, false, false, true, false), JsonSerializer.Deserialize<ActionPermissions>(json));
    }

    /// <summary>Seed files and settings backups written before the split keep their meaning.</summary>
    [Fact]
    public void OldCombinedJsonGrantsBothActions()
    {
        var old = JsonSerializer.Deserialize<ActionPermissions>(
            """{"view":true,"createEdit":true,"delete":false,"approve":false,"printExport":true}""");
        Assert.Equal(new ActionPermissions(true, true, true, false, false, true, true), old);
    }
}
