using System.Text.Json;
using Core.Application.Common.Exceptions;
using Core.Application.Modules.SystemConfig;
using Xunit;

namespace Core.Tests.Modules.SystemConfig;

public sealed class SystemConfigSectionsTests
{
    [Fact]
    public void RejectsMissingRequiredFields()
    {
        using var value = JsonDocument.Parse("""{"defaultWarehouse":"WH01"}""");
        Assert.Throws<BusinessRuleException>(() => SystemConfigSections.Validate("systemDefaults", value.RootElement));
    }

    [Fact]
    public void AcceptsSectionAndReturnsFrontendSpelling()
    {
        using var value = JsonDocument.Parse(
            """{"defaultWarehouse":"WH01","costingMethod":"FIFO","defaultCurrency":"VND","autoNumbering":{}}""");
        Assert.Equal("systemDefaults", SystemConfigSections.Validate("SYSTEMDEFAULTS", value.RootElement));
    }

    [Fact]
    public void CurrenciesMustBeAnArrayOfObjects()
    {
        using var value = JsonDocument.Parse("""[1, 2]""");
        Assert.Throws<BusinessRuleException>(() => SystemConfigSections.Validate("currencies", value.RootElement));
    }

    [Fact]
    public void EverySectionHasAPermissionFunction()
    {
        Assert.All(SystemConfigSections.Keys.Keys, section => Assert.True(SystemConfigSections.Functions.ContainsKey(section)));
    }
}
