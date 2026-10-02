using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Notifications;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Core.Tests.Common;

public sealed class CoreContextModelTests
{
    private static CoreContext CreateContext() => new(new DbContextOptionsBuilder<CoreContext>()
        .UseNpgsql("Host=localhost;Database=model_only;Username=model_only;Password=model_only").Options);

    [Theory]
    [InlineData(typeof(SysUserRole))]
    [InlineData(typeof(SysRoleCommand))]
    [InlineData(typeof(SysUserCommand))]
    [InlineData(typeof(UserCompanyUnit))]
    [InlineData(typeof(NotificationRead))]
    public void JoinTablesHaveCompositeKeys(Type entity)
    {
        using var context = CreateContext();
        Assert.Equal(2, context.Model.FindEntityType(entity)!.FindPrimaryKey()!.Properties.Count);
    }

    [Theory]
    [InlineData(typeof(Core.Domain.Modules.Fiscal.FiscalPeriod))]
    [InlineData(typeof(Core.Domain.Modules.VoucherNumbering.VoucherSequence))]
    public void PeriodTablesHaveThreePartKeys(Type entity)
    {
        using var context = CreateContext();
        Assert.Equal(3, context.Model.FindEntityType(entity)!.FindPrimaryKey()!.Properties.Count);
    }

    /// <summary>Naming convention: sys_* system tables, erp_* business tables, snake_case columns.</summary>
    [Fact]
    public void TablesAndColumnsFollowNamingConvention()
    {
        using var context = CreateContext();
        foreach (var entity in context.Model.GetEntityTypes())
        {
            var table = entity.GetTableName()!;
            Assert.Matches("^(sys|erp)_[a-z0-9_]+$", table);
            foreach (var property in entity.GetProperties())
                Assert.Matches("^[a-z0-9_]+$", property.GetColumnName());
        }
    }

    /// <summary>Every business table (erp_*) has created_at / created_by / updated_at / updated_by (ErpEntity, UTC).</summary>
    [Fact]
    public void BusinessTablesHaveRecordStamps()
    {
        using var context = CreateContext();
        foreach (var entity in context.Model.GetEntityTypes().Where(e => e.GetTableName()!.StartsWith("erp_")))
        {
            Assert.True(typeof(Core.Domain.Common.ErpEntity).IsAssignableFrom(entity.ClrType),
                $"{entity.ClrType.Name} ({entity.GetTableName()}) must inherit ErpEntity");
            foreach (var column in new[] { "created_at", "created_by", "updated_at", "updated_by" })
                Assert.Contains(entity.GetProperties(), p => p.GetColumnName() == column);
            Assert.Equal("timestamp with time zone", entity.FindProperty("CreatedAt")!.GetColumnType());
        }
    }

    /// <summary>
    /// Records edited in forms carry PostgreSQL's row version (xmin) as concurrency token, so a save over a newer
    /// version fails (record.changed) instead of overwriting someone else's change. Every business table has it.
    /// </summary>
    [Fact]
    public void VersionedRecordsUseXminAsConcurrencyToken()
    {
        using var context = CreateContext();
        var versioned = context.Model.GetEntityTypes()
            .Where(e => typeof(Core.Domain.Common.IVersioned).IsAssignableFrom(e.ClrType)).ToList();
        Assert.Contains(versioned, e => e.ClrType == typeof(SysUser));
        foreach (var entity in versioned)
        {
            var version = entity.FindProperty(nameof(Core.Domain.Common.IVersioned.Version))!;
            Assert.Equal("xmin", version.GetColumnName());
            Assert.Equal("xid", version.GetColumnType());
            Assert.True(version.IsConcurrencyToken, $"{entity.ClrType.Name}.Version must be a concurrency token");
            Assert.Equal(Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.OnAddOrUpdate, version.ValueGenerated);
        }
        foreach (var entity in context.Model.GetEntityTypes().Where(e => e.GetTableName()!.StartsWith("erp_")))
            Assert.Contains(entity, versioned);
    }

    /// <summary>The sys_* audit columns are "timestamp" in SQL; timestamptz would reject local times.</summary>
    [Theory]
    [InlineData(typeof(SysUser))]
    [InlineData(typeof(SysRole))]
    [InlineData(typeof(SysRoleCommand))]
    public void AuditColumnsUseTimestampWithoutTimeZone(Type entity)
    {
        using var context = CreateContext();
        var type = context.Model.FindEntityType(entity)!;
        Assert.Equal("timestamp without time zone", type.FindProperty("CreateTime")!.GetColumnType());
        Assert.Equal("timestamp without time zone", type.FindProperty("UpdateTime")!.GetColumnType());
    }
}
