using Core.Application.Common.Security;
using Core.Domain.Common;
using Core.Domain.Modules.Approvals;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Notifications;
using Core.Domain.Modules.SystemConfig;
using Core.Domain.Modules.Users;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Common.Persistence;

/// <summary>
/// EF Core context for PostgreSQL. The schema is created by the scripts in sql/postgresql
/// (there are no EF migrations). The database has no foreign keys: the relationships below only let
/// EF join tables through their link columns; services check that linked records exist.
/// </summary>
public sealed class CoreContext(DbContextOptions<CoreContext> options, ICurrentUser? currentUser = null)
    : DbContext(options)
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
    public DbSet<UserCompanyUnit> UserCompanyUnits => Set<UserCompanyUnit>();

    // Notifications
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationRead> NotificationReads => Set<NotificationRead>();

    // System configuration
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();

    // Approvals
    public DbSet<ApprovalRule> ApprovalRules => Set<ApprovalRule>();
    public DbSet<DocumentApproval> DocumentApprovals => Set<DocumentApproval>();

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
        model.Entity<UserCompanyUnit>().HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitCode);

        model.Entity<NotificationRead>().HasKey(x => new { x.NotificationId, x.UserId });
        model.Entity<NotificationRead>().HasOne<Notification>().WithMany().HasForeignKey(x => x.NotificationId);

        model.Entity<SystemSetting>().HasIndex(x => new { x.Key, x.Scope }).IsUnique();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        StampAuditFields();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void StampAuditFields()
    {
        var actor = currentUser is { IsAuthenticated: true } ? currentUser.UserId.ToString() : null;
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
