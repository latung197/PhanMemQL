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

    private const string GoodNumberFormat =
        """{"thousandSeparator":",","decimalSeparator":".","currencySymbol":"VNĐ","currencyPosition":"suffix","amountDecimals":0,"quantityDecimals":2}""";

    [Fact]
    public void AcceptsAValidNumberFormat()
    {
        using var value = JsonDocument.Parse(GoodNumberFormat);
        Assert.Equal("numberFormat", SystemConfigSections.Validate("numberFormat", value.RootElement));
        using var spaces = JsonDocument.Parse("""{"thousandSeparator":" ","decimalSeparator":","}""");
        SystemConfigSections.Validate("numberFormat", spaces.RootElement);
    }

    /// <summary>The format applies to every screen of every user, so bad values are refused.</summary>
    [Theory]
    [InlineData("""{"thousandSeparator":".","decimalSeparator":"."}""")]
    [InlineData("""{"thousandSeparator":"x","decimalSeparator":"."}""")]
    [InlineData("""{"thousandSeparator":",","decimalSeparator":";"}""")]
    [InlineData("""{"thousandSeparator":",","decimalSeparator":".","amountDecimals":-5}""")]
    [InlineData("""{"thousandSeparator":",","decimalSeparator":".","quantityDecimals":99}""")]
    [InlineData("""{"thousandSeparator":",","decimalSeparator":".","percentDecimals":1.5}""")]
    [InlineData("""{"thousandSeparator":",","decimalSeparator":".","currencyPosition":"xyz"}""")]
    [InlineData("""{"thousandSeparator":",","decimalSeparator":".","currencySymbol":"MOT-KY-HIEU-QUA-DAI"}""")]
    public void RejectsABadNumberFormat(string json)
    {
        using var value = JsonDocument.Parse(json);
        Assert.Throws<BusinessRuleException>(() => SystemConfigSections.Validate("numberFormat", value.RootElement));
    }

    /// <summary>The accounting currency comes from the currency catalog, so the section does not need it.</summary>
    [Fact]
    public void SystemDefaultsNeedNoAccountingCurrency()
    {
        using var value = JsonDocument.Parse("""{"costingMethod":"FIFO","defaultVatRate":8}""");
        Assert.Equal("systemDefaults", SystemConfigSections.Validate("systemDefaults", value.RootElement));
    }

    [Fact]
    public void WithFieldSetsOrRemovesOneField()
    {
        using var value = JsonDocument.Parse("""{"costingMethod":"FIFO","defaultCurrency":"USD"}""");
        var stored = SystemConfigSections.WithField(value.RootElement, SystemConfigSections.BaseCurrencyField, null);
        Assert.False(stored.TryGetProperty("defaultCurrency", out _));
        Assert.Equal("FIFO", stored.GetProperty("costingMethod").GetString());
        var read = SystemConfigSections.WithField(stored, SystemConfigSections.BaseCurrencyField, "VND");
        Assert.Equal("VND", read.GetProperty("defaultCurrency").GetString());
    }

    [Fact]
    public void OnlyUnitDefaultsLiveOnAUnit()
    {
        Assert.Equal(["unitDefaults"], SystemConfigSections.Keys.Keys.Where(SystemConfigSections.IsUnitOnly));
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
