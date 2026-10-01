using System.Reflection;
using System.Text.RegularExpressions;
using Core.Domain.Common;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Core.Tests.Common;

/// <summary>Every table says whether its changes are logged (Core.Domain/Common/AuditAttributes.cs).</summary>
public sealed class AuditDeclarationTests
{
    private static CoreContext CreateContext() => new(new DbContextOptionsBuilder<CoreContext>()
        .UseNpgsql("Host=localhost;Database=model_only;Username=model_only;Password=model_only").Options);

    public static IEnumerable<object[]> EntityTypes()
    {
        using var context = CreateContext();
        return context.Model.GetEntityTypes().Select(t => new object[] { t.ClrType }).ToList();
    }

    [Theory]
    [MemberData(nameof(EntityTypes))]
    public void EveryEntityDeclaresItsChangeLog(Type entity)
    {
        var declared = entity.GetCustomAttribute<AuditedAttribute>() is not null
            || entity.GetCustomAttribute<NotAuditedAttribute>() is not null
            || entity.GetCustomAttribute<AuditedChildAttribute>() is not null;
        Assert.True(declared, $"{entity.Name}: add [Audited(function, objectType)] or [NotAudited(reason)].");
    }

    [Theory]
    [MemberData(nameof(EntityTypes))]
    public void AuditDeclarationsNameExistingProperties(Type entity)
    {
        bool Has(string name) => entity.GetProperty(name) is not null;
        if (entity.GetCustomAttribute<AuditedAttribute>() is { } audited)
        {
            Assert.True(Core.Application.Common.Permissions.FunctionCatalog.IsFunction(audited.Function),
                $"{entity.Name}: unknown function {audited.Function}");
            foreach (Match m in Regex.Matches(audited.Label ?? "", @"\{(\w+)\}"))
                Assert.True(Has(m.Groups[1].Value), $"{entity.Name}: label uses unknown property {m.Groups[1].Value}");
            if (audited.SoftDelete is { } flag) Assert.True(Has(flag), $"{entity.Name}: unknown soft delete flag {flag}");
        }
        if (entity.GetCustomAttribute<AuditedChildAttribute>() is { } child)
        {
            Assert.True(Has(child.ParentKeyProperty) && Has(child.ValueProperty), $"{entity.Name}: unknown child properties");
            Assert.NotNull(child.Parent.GetCustomAttribute<AuditedAttribute>());
        }
    }

    [Fact]
    public void SecretsAreNeverLogged()
    {
        var hash = typeof(Core.Domain.Modules.Users.SysUser).GetProperty(nameof(Core.Domain.Modules.Users.SysUser.PasswordHash))!;
        Assert.NotNull(hash.GetCustomAttribute<AuditIgnoreAttribute>());
    }
}
