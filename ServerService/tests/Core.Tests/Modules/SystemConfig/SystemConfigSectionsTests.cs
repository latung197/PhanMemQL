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
            """{"defaultWarehouse":"WH01","costingMethod":"FIFO","defaultCurrency":"VND"}""");
        Assert.Equal("systemDefaults", SystemConfigSections.Validate("SYSTEMDEFAULTS", value.RootElement));
    }

    /// <summary>Currencies and exchange rates moved to their own tables.</summary>
    [Theory]
    [InlineData("currencies")]
    [InlineData("exchangeRates")]
    public void TableBackedSettingsAreNoLongerSections(string section)
    {
        using var value = JsonDocument.Parse("""{}""");
        Assert.Throws<BusinessRuleException>(() => SystemConfigSections.Validate(section, value.RootElement));
    }

    [Fact]
    public void SectionsMustBeObjects()
    {
        using var value = JsonDocument.Parse("""[1, 2]""");
        Assert.Throws<BusinessRuleException>(() => SystemConfigSections.Validate("numberFormat", value.RootElement));
    }

    [Fact]
    public void ReadsTheDataEntryStartDate()
    {
        using var value = JsonDocument.Parse("""{"fiscalYear":2026,"startDate":"2026-01-01"}""");
        var sections = new Dictionary<string, JsonElement> { ["fiscalConfig"] = value.RootElement };
        Assert.Equal(new DateOnly(2026, 1, 1), SystemConfigSections.StartDate(sections));
        Assert.Null(SystemConfigSections.StartDate(new Dictionary<string, JsonElement>()));
    }

    [Fact]
    public void EverySectionHasAPermissionFunction()
    {
        Assert.All(SystemConfigSections.Keys.Keys, section => Assert.True(SystemConfigSections.Functions.ContainsKey(section)));
    }
}
