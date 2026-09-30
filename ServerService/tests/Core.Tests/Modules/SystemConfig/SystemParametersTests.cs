using System.Text.Json;
using Core.Application.Common.Exceptions;
using Core.Application.Modules.SystemConfig;
using Xunit;

namespace Core.Tests.Modules.SystemConfig;

public sealed class SystemParametersTests
{
    private static JsonElement Json(string text) => JsonDocument.Parse(text).RootElement.Clone();

    [Fact]
    public void MissingSectionsGiveTheDefaults()
    {
        Assert.Equal(SystemParameters.Default, SystemParameters.From(new Dictionary<string, JsonElement>()));
    }

    [Fact]
    public void UnitValuesOverrideTheCompanyValues()
    {
        var sections = new Dictionary<string, JsonElement>
        {
            ["systemDefaults"] = Json("""{"costingMethod":"FIFO","defaultCurrency":"VND","defaultVatRate":8,"defaultWarehouse":"KH-HCM-01","allowNegativeStock":false,"requireApprovalBeforePosting":false}"""),
            ["unitDefaults"] = Json("""{"defaultWarehouse":"KH-HN-01","allowNegativeStock":null}""")
        };
        var p = SystemParameters.From(sections);
        Assert.Equal(CostingMethods.Fifo, p.CostingMethod);
        Assert.Equal(8m, p.DefaultVatRate);
        Assert.False(p.RequireApprovalBeforePosting);
        Assert.Equal("KH-HN-01", p.DefaultWarehouse);   // unit value
        Assert.False(p.AllowNegativeStock);             // null in the unit = follow the company value
    }

    [Fact]
    public void UnknownStoredValuesFallBackToDefaults()
    {
        var p = SystemParameters.From(new Dictionary<string, JsonElement>
        {
            ["systemDefaults"] = Json("""{"costingMethod":"LIFO","defaultCurrency":"VND","defaultVatRate":7}""")
        });
        Assert.Equal(SystemParameters.Default.CostingMethod, p.CostingMethod);
        Assert.Equal(SystemParameters.Default.DefaultVatRate, p.DefaultVatRate);
    }

    [Theory]
    [InlineData("""{"costingMethod":"LIFO","defaultCurrency":"VND"}""")]
    [InlineData("""{"costingMethod":"FIFO","defaultCurrency":"VND","defaultVatRate":7}""")]
    [InlineData("""{"costingMethod":"FIFO","defaultCurrency":"VND","allowNegativeStock":"yes"}""")]
    public void InvalidValuesAreRejected(string json) =>
        Assert.Throws<BusinessRuleException>(() => SystemConfigSections.Validate("systemDefaults", Json(json)));

    [Fact]
    public void UnitDefaultsNeedNoRequiredFields()
    {
        Assert.Equal("unitDefaults", SystemConfigSections.Validate("unitDefaults", Json("""{"allowNegativeStock":true}""")));
        Assert.True(SystemConfigSections.IsUnitOnly("unitDefaults"));
        Assert.False(SystemConfigSections.IsUnitOnly("systemDefaults"));
    }
}
