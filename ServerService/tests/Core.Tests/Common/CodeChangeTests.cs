using System.Reflection;
using Core.Application.Common.Permissions;
using Core.Infrastructure.Common.Catalogs;
using Xunit;

namespace Core.Tests.Common;

/// <summary>Đổi mã / gộp mã: the catalogs that allow it (CatalogSpec.CodeChange) and the special right CHANGE_CODE go together.</summary>
public sealed class CodeChangeTests
{
    /// <summary>The CatalogSpec every catalog service keeps in a private static field.</summary>
    private static IEnumerable<CatalogSpec> Specs() => typeof(CatalogService<,,>).Assembly.GetTypes()
        .SelectMany(t => t.GetFields(BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public))
        .Where(f => f.FieldType == typeof(CatalogSpec)).Select(f => (CatalogSpec)f.GetValue(null)!);

    [Fact]
    public void EveryCatalogThatAllowsCodeChangeHasTheRightAndTheOtherWayRound()
    {
        var allowed = Specs().Where(s => s.CodeChange).Select(s => s.Function).OrderBy(x => x).ToList();
        Assert.NotEmpty(allowed);
        Assert.Equal(SpecialRightCatalog.CodeChangeCatalogs.OrderBy(x => x), allowed);
        foreach (var function in allowed)
            Assert.Contains(SpecialRightCatalog.All, r => r.Function == function && r.Code == SpecialRightCatalog.ChangeCode);
    }

    [Fact]
    public void CatalogsWhoseCodesAreBuiltIntoOtherCodesDoNotAllowIt()
    {
        // Lots (VT@LOT), exchange rates (USD@date), unit conversions and materials (lots and conversions carry the code) wait for a later step.
        var blocked = new[] { "inv_lot_cat", "sys_exchange_rates", "inv_uom_conversion_cat", "inv_material_cat", "inv_uom_cat" };
        foreach (var spec in Specs().Where(s => blocked.Contains(s.Function))) Assert.False(spec.CodeChange, spec.Function);
    }
}
