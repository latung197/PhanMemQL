using Core.Application.Common.Exceptions;
using Core.Application.Common.Security;
using Core.Infrastructure.Common.Auditing;
using Core.Domain.Common;
using Core.Domain.Modules.Approvals;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Currencies;
using Core.Domain.Modules.Departments;
using Core.Domain.Modules.Fiscal;
using Core.Domain.Modules.Inventory;
using Core.Domain.Modules.Inventory.Documents.GoodsReceipts;
using Core.Domain.Modules.Languages;
using Core.Domain.Modules.Notifications;
using Core.Domain.Modules.SystemConfig;
using Core.Domain.Modules.Users;
using Core.Domain.Modules.VoucherNumbering;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Common.Persistence;

/// <summary>
/// EF Core context for PostgreSQL. The schema is created by the scripts in sql/postgresql
/// (there are no EF migrations). The database has no foreign keys: the relationships below only let
/// EF join tables through their link columns; services check that linked records exist.
/// </summary>
public sealed class CoreContext(DbContextOptions<CoreContext> options, ICurrentUser? currentUser = null,
    AuditTrail? auditTrail = null) : DbContext(options)
{
    // Users & permissions
    public DbSet<SysUser> Users => Set<SysUser>();
    public DbSet<SysRole> Roles => Set<SysRole>();
    public DbSet<SysUserRole> UserRoles => Set<SysUserRole>();
    public DbSet<SysCommand> Commands => Set<SysCommand>();
    public DbSet<SysRoleCommand> RoleCommands => Set<SysRoleCommand>();
    public DbSet<SysUserCommand> UserCommands => Set<SysUserCommand>();
    public DbSet<SysRoleRight> RoleRights => Set<SysRoleRight>();
    public DbSet<SysUserRight> UserRights => Set<SysUserRight>();

    // Company units
    public DbSet<CompanyUnit> CompanyUnits => Set<CompanyUnit>();
    public DbSet<CompanyUnitTranslation> CompanyUnitTranslations => Set<CompanyUnitTranslation>();
    public DbSet<UserCompanyUnit> UserCompanyUnits => Set<UserCompanyUnit>();

    // Notifications
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationRead> NotificationReads => Set<NotificationRead>();

    // System configuration
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();

    // Approvals
    public DbSet<ApprovalRule> ApprovalRules => Set<ApprovalRule>();
    public DbSet<DocumentApproval> DocumentApprovals => Set<DocumentApproval>();

    // Organization and accounting settings
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Currency> Currencies => Set<Currency>();
    public DbSet<ExchangeRate> ExchangeRates => Set<ExchangeRate>();
    public DbSet<FiscalPeriod> FiscalPeriods => Set<FiscalPeriod>();
    public DbSet<VoucherNumberingRule> VoucherNumberingRules => Set<VoucherNumberingRule>();
    public DbSet<VoucherSequence> VoucherSequences => Set<VoucherSequence>();

    // Languages
    public DbSet<Language> Languages => Set<Language>();

    // Inventory
    public DbSet<Uom> Uoms => Set<Uom>();
    public DbSet<UomTranslation> UomTranslations => Set<UomTranslation>();
    public DbSet<UomConversion> UomConversions => Set<UomConversion>();
    public DbSet<MaterialGroup> MaterialGroups => Set<MaterialGroup>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<WarehouseType> WarehouseTypes => Set<WarehouseType>();
    public DbSet<WarehouseTypeTranslation> WarehouseTypeTranslations => Set<WarehouseTypeTranslation>();
    public DbSet<GoodsReceipt> GoodsReceipts => Set<GoodsReceipt>();
    public DbSet<GoodsReceiptLine> GoodsReceiptLines => Set<GoodsReceiptLine>();

    // Change log (all functions)
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // How lists are shown (per user / company default)
    public DbSet<GridLayout> GridLayouts => Set<GridLayout>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<SysUserRole>().HasKey(x => new { x.UserId, x.RoleId });
        model.Entity<SysUserRole>().HasOne(x => x.Role).WithMany().HasForeignKey(x => x.RoleId);

        model.Entity<SysRoleCommand>().HasKey(x => new { x.RoleId, x.MenuId0 });
        model.Entity<SysRole>().HasMany(x => x.Permissions).WithOne().HasForeignKey(x => x.RoleId);
        model.Entity<SysRoleCommand>().HasOne<SysCommand>().WithMany().HasForeignKey(x => x.MenuId0);

        model.Entity<SysUserCommand>().HasKey(x => new { x.UserId, x.MenuId0 });
        model.Entity<SysUserCommand>().HasOne<SysCommand>().WithMany().HasForeignKey(x => x.MenuId0);

        model.Entity<SysRoleRight>().HasKey(x => new { x.RoleId, x.MenuId0, x.RightCode });
        model.Entity<SysUserRight>().HasKey(x => new { x.UserId, x.MenuId0, x.RightCode });

        model.Entity<UserCompanyUnit>().HasKey(x => new { x.UserId, x.UnitCode });
        model.Entity<CompanyUnitTranslation>().HasKey(x => new { x.UnitCode, x.LanguageCode });
        model.Entity<UserCompanyUnit>().HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitCode);

        model.Entity<NotificationRead>().HasKey(x => new { x.NotificationId, x.UserId });
        model.Entity<NotificationRead>().HasOne<Notification>().WithMany().HasForeignKey(x => x.NotificationId);

        model.Entity<SystemSetting>().HasIndex(x => new { x.Key, x.Scope }).IsUnique();

        model.Entity<ExchangeRate>().HasIndex(x => new { x.CurrencyCode, x.RateDate }).IsUnique();
        model.Entity<FiscalPeriod>().HasKey(x => new { x.UnitCode, x.Year, x.Month });
        model.Entity<VoucherSequence>().HasKey(x => new { x.VoucherType, x.UnitCode, x.PeriodKey });
        model.Entity<UomTranslation>().HasKey(x => new { x.UomCode, x.LanguageCode });
        model.Entity<WarehouseTypeTranslation>().HasKey(x => new { x.WarehouseTypeCode, x.LanguageCode });
        model.Entity<GoodsReceipt>().HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.ReceiptId);

        // Row version of records edited in forms (IVersioned): PostgreSQL's xmin system column, changed by every update
        // and checked by every UPDATE / DELETE of the row (RowVersions.ExpectVersion sets the version a screen loaded).
        foreach (var type in model.Model.GetEntityTypes().Where(t => typeof(IVersioned).IsAssignableFrom(t.ClrType)).ToList())
            model.Entity(type.ClrType).Property(nameof(IVersioned.Version)).HasColumnName("xmin").HasColumnType("xid").IsRowVersion();
    }

    /// <summary>
    /// Saves and writes the change log of [Audited] entities (AuditTrail) in the same transaction: the changes are read
    /// before saving, the log rows (with generated ids) are added and saved right after. Without an open transaction one
    /// is opened for the two saves.
    /// </summary>
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            return await SaveWithChangeLogAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // The row was changed (other version) or deleted by someone else since it was loaded.
            throw new ConflictException("record.changed");
        }
    }

    private async Task<int> SaveWithChangeLogAsync(CancellationToken cancellationToken)
    {
        StampAuditFields();
        var batch = auditTrail is { Enabled: true } ? auditTrail.Collect(ChangeTracker) : null;
        if (batch is null || batch.IsEmpty) return await base.SaveChangesAsync(cancellationToken);

        var own = Database.CurrentTransaction is null ? await Database.BeginTransactionAsync(cancellationToken) : null;
        try
        {
            var saved = await base.SaveChangesAsync(cancellationToken);
            await auditTrail!.WriteAsync(this, batch, cancellationToken);
            await base.SaveChangesAsync(cancellationToken);
            if (own is not null) await own.CommitAsync(cancellationToken);
            return saved;
        }
        finally
        {
            if (own is not null) await own.DisposeAsync();
        }
    }

    /// <summary>Not used by the services (they save asynchronously); kept without change log on purpose.</summary>
    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampAuditFields();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    /// <summary>
    /// Fills the record stamps: createtime / updateid... of the legacy sys_* tables (local time, user id as text) and
    /// created_at / updated_by... of the erp_* tables (ErpEntity, UTC, user id). What a request sends is ignored.
    /// </summary>
    private void StampAuditFields()
    {
        int? actorId = currentUser is { IsAuthenticated: true } ? currentUser.UserId : null;
        var utcNow = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<ErpEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = utcNow;
                entry.Entity.CreatedBy = actorId;
                entry.Entity.UpdatedAt = null;
                entry.Entity.UpdatedBy = null;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Property(x => x.CreatedAt).IsModified = false;
                entry.Property(x => x.CreatedBy).IsModified = false;
                entry.Entity.UpdatedAt = utcNow;
                entry.Entity.UpdatedBy = actorId;
            }
        }

        var actor = actorId?.ToString();
        var now = DateTime.Now;
        foreach (var entry in ChangeTracker.Entries<IAuditable>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreateTime = now;
                entry.Entity.CreateId ??= actor;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdateTime = now;
                entry.Entity.UpdateId = actor;
            }
        }
    }
}
