using System.Text.Json;
using Core.Application.Common.Permissions;
using Core.Domain.Modules.Users;
using Xunit;

namespace Core.Tests.Common;

/// <summary>
/// Runs the shared DocumentPolicyCases.json against DocumentStatusPolicy. The frontend mirror
/// (utils/documentPolicy.ts) runs the same file with "npm run check-policy", so both stay in step.
/// </summary>
public sealed class DocumentPolicyCasesTests
{
    /// <summary>Actions / Rights are on the voucher inv_receipt; ScreenActions on its approval screen inv_approve_receipt.</summary>
    private sealed record PolicyCase(string Name, string Action, string Status, bool IsOwner, string[] Actions,
        string[] Rights, bool Allowed, string[]? ScreenActions = null);

    private sealed record CaseFile(PolicyCase[] Cases);

    public static TheoryData<string> CaseNames()
    {
        var data = new TheoryData<string>();
        foreach (var c in Load()) data.Add(c.Name);
        return data;
    }

    private static PolicyCase[] Load() => JsonSerializer.Deserialize<CaseFile>(
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Common", "DocumentPolicyCases.json")),
        new JsonSerializerOptions(JsonSerializerDefaults.Web))!.Cases;

    [Theory]
    [MemberData(nameof(CaseNames))]
    public void MatchesTheSharedCase(string name)
    {
        var c = Load().Single(x => x.Name == name);
        static ActionPermissions Of(string[] a) => new(a.Contains("view"), a.Contains("createEdit"),
            a.Contains("delete"), a.Contains("approve"), a.Contains("printExport"));
        var matrix = PermissionMatrix.Resolve(false, [], [("inv_receipt", Of(c.Actions)), ("inv_approve_receipt", Of(c.ScreenActions ?? []))]);
        var rights = c.Rights.Select(r => SpecialRightCatalog.Key("inv_receipt", r)).ToHashSet(StringComparer.Ordinal);
        // Built the way voucher services build it.
        var actor = DocumentActor.For(matrix, rights, "inv_receipt", c.IsOwner);
        var decision = DocumentStatusPolicy.Check(Enum.Parse<DocumentAction>(c.Action), Enum.Parse<DocumentStatus>(c.Status), actor);
        Assert.Equal(c.Allowed, decision.Allowed);
    }
}
