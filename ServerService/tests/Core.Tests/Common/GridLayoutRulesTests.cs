using System.Text.Json;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Layouts;
using Xunit;

namespace Core.Tests.Common;

public sealed class GridLayoutRulesTests
{
    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement.Clone();

    [Theory]
    [InlineData("""{"columns":[{"key":"code","visible":true,"width":120},{"key":"stamp.created","visible":false}],"sortKey":"name","sortDir":"asc","pageSize":20}""")]
    [InlineData("""{"pageSize":50}""")]
    public void AcceptsLayouts(string json) => GridLayoutRules.Validate(Json(json));

    [Theory]
    [InlineData("""[]""")]
    [InlineData("""{"columns":{}}""")]
    [InlineData("""{"columns":[{"visible":true}]}""")]
    [InlineData("""{"columns":[{"key":"a b"}]}""")]
    [InlineData("""{"columns":[{"key":"<script>"}]}""")]
    public void RefusesBadLayouts(string json) =>
        Assert.Throws<BusinessRuleException>(() => GridLayoutRules.Validate(Json(json)));

    [Fact]
    public void RefusesHugeLayouts() =>
        Assert.Throws<BusinessRuleException>(() => GridLayoutRules.Validate(Json($$"""{"note":"{{new string('x', 20_000)}}"}""")));

    [Theory]
    [InlineData("main", true)]
    [InlineData("lines.detail", true)]
    [InlineData("", false)]
    [InlineData("a/b", false)]
    public void GridKeys(string key, bool ok)
    {
        if (ok) GridLayoutRules.ValidateKey(key);
        else Assert.Throws<BusinessRuleException>(() => GridLayoutRules.ValidateKey(key));
    }
}
