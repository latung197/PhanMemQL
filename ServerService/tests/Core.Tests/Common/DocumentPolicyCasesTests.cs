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
    private sealed record PolicyCase(string Name, string Action, string Status, bool IsOwner, string[] Actions,
        string[] Rights, bool Allowed);

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
        var actions = new ActionPermissions(c.Actions.Contains("view"), c.Actions.Contains("createEdit"),
            c.Actions.Contains("delete"), c.Actions.Contains("approve"), c.Actions.Contains("printExport"));
        var actor = new DocumentActor(actions, c.Rights.ToHashSet(StringComparer.Ordinal), c.IsOwner);
        var decision = DocumentStatusPolicy.Check(Enum.Parse<DocumentAction>(c.Action), Enum.Parse<DocumentStatus>(c.Status), actor);
        Assert.Equal(c.Allowed, decision.Allowed);
    }
}
