using Core.Application.Common.Exceptions;
using Core.Application.Common.Localization;
using Core.Infrastructure.Common.Persistence;
using Npgsql;
using Xunit;

namespace Core.Tests.Common;

public sealed class DatabaseErrorsTests
{
    [Theory]
    [InlineData("Key (code)=(KG) already exists.", "code", "KG")]
    [InlineData("Key (lower((name)::text))=(kilogram) already exists.", "name", "kilogram")]
    [InlineData("Key (currency_code, rate_date)=(USD, 2026-10-01) already exists.", "currency_code,rate_date", "USD, 2026-10-01")]
    public void ParsesTheDuplicateKey(string detail, string columns, string value)
    {
        var parsed = DatabaseErrors.Parse(detail);
        Assert.Equal(columns, string.Join(",", parsed.Columns));
        Assert.Equal(value, parsed.Value);
    }

    [Fact]
    public void NamesFieldAndValue()
    {
        Messages.CurrentLanguage = "vi";
        var error = DatabaseErrors.Duplicate("Key (lower((name)::text))=(kilogram) already exists.", "ux_erp_uom_name");
        Assert.Equal("Tên \"kilogram\" đã tồn tại. Vui lòng nhập giá trị khác.", error.Message);
        Messages.CurrentLanguage = "en";
        Assert.Equal("Currency code, rate date \"USD, 2026-10-01\" already exists. Please enter another value.",
            DatabaseErrors.Duplicate("Key (currency_code, rate_date)=(USD, 2026-10-01) already exists.", null).Message);
        Messages.CurrentLanguage = "vi";
    }

    [Fact]
    public void WithoutDetailNamesTheFieldFromTheConstraint()
    {
        Messages.CurrentLanguage = "vi";
        Assert.Equal("Tên bị trùng với một bản ghi đã có. Vui lòng nhập giá trị khác.",
            DatabaseErrors.Duplicate(null, "ux_erp_uom_name").Message);
        Assert.Equal("Giá trị bị trùng với một bản ghi đã có. Vui lòng nhập giá trị khác.",
            DatabaseErrors.Duplicate(null, "ux_erp_x_unknowncol").Message);
    }

    [Fact]
    public void OtherExceptionsAreNotTranslated() =>
        Assert.Null(DatabaseErrors.Translate(new InvalidOperationException("x", new TimeoutException())));
}
