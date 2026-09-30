using Core.Domain;
using Core.Domain.Entity;
using Core.Domain.Entity.SystemEntities;
using Core.Domain.Entity.Erp;
using Core.Application.Security;
using Core.Utils;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Data;
using System.Reflection;

namespace Core.Infrastructure.Context
{
    public class CoreContext : DbContext
    {
        #region Properties
        private readonly IConfiguration _configuration;
        private readonly IUserPrincipalService _userPrincipalService;
        public static readonly ILoggerFactory loggerFactory = LoggerFactory.Create(builder =>
        {
#if DEBUG
            builder
                .AddFilter(DbLoggerCategory.Database.Command.Name, LogLevel.Warning)
                .AddFilter(DbLoggerCategory.Query.Name, LogLevel.Debug)
                .AddConsole();
#endif

        }
        );

        #endregion
        #region Constructor
        public CoreContext(DbContextOptions<CoreContext> options
            , IConfiguration configuration
            , IUserPrincipalService userPrincipalService) : base(options)
        {
            _configuration = configuration;
            _userPrincipalService = userPrincipalService;
        }

        public CoreContext() : base()
        {

        }

        public CoreContext(DbContextOptions<CoreContext> options) : base(options)
        {

        }
        public CoreContext(IUserPrincipalService userPrincipalService) : base()
        {
            _userPrincipalService = userPrincipalService;
        }
        #endregion
        #region Method
        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            base.OnConfiguring(optionsBuilder);
            if (optionsBuilder.IsConfigured) return;
            if (_configuration is null) throw new InvalidOperationException("CoreContext requires database configuration.");
            optionsBuilder.UseLoggerFactory(loggerFactory)
                .UseNpgsql(_configuration.GetConnectionString("CoreContext"));
        }
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<SysUserRole>().HasKey(x => new { x.UserId, x.RoleId });
            modelBuilder.Entity<SysRoleCommand>().HasKey(x => new { x.RoleId, x.MenuId0 });
            modelBuilder.Entity<SysUserCommand>().HasKey(x => new { x.UserId, x.MenuId0 });
            modelBuilder.Entity<Plant>().HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitCode).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<UserPlantAccess>().HasKey(x => new { x.UserId, x.PlantCode });
            modelBuilder.Entity<UserPlantAccess>().HasOne(x => x.Plant).WithMany().HasForeignKey(x => x.PlantCode).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<UserUnitAccess>().HasKey(x => new { x.UserId, x.UnitCode });
            modelBuilder.Entity<UserUnitAccess>().HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitCode).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<ErpNotificationRead>().HasKey(x => new { x.NotificationId, x.UserId });
            modelBuilder.Entity<ErpNotificationRead>().HasOne<ErpNotification>().WithMany().HasForeignKey(x => x.NotificationId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<ErpSetting>().HasIndex(x => new { x.Key, x.Scope }).IsUnique();
        }

        private object CreateWithValues(EntityEntry values)
        {
            object entity = Activator.CreateInstance(values.Entity.GetType());
            foreach (PropertyInfo property in values.Entity.GetType().GetProperties())
            {
                //var property = type.GetProperty(propname.);
                property.SetValue(entity, values.Property(property.Name).OriginalValue);
            }

            return entity;
        }
        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            //Do something here
            try
            {
                List<EntityEntry> modifiedEntries = ChangeTracker.Entries()
                    .Where(x => x.Entity is IAuditable
                                && (x.State == EntityState.Added || x.State == EntityState.Modified)).ToList();

                if (modifiedEntries.Any())
                {
                    foreach (EntityEntry entry in modifiedEntries)
                    {
                        IAuditable? entity = entry.Entity as IAuditable;
                        if (entity is null)
                        {
                            continue;
                        }

                        if (entry.State == EntityState.Added)
                        {
                            //Acc CreateID, CreateDt here
                            if (_userPrincipalService.IsAuthenticated)
                                entity.CreateId = _userPrincipalService.UserId.ToString();

                            entity.CreateTime = DateTime.Now;
                        }
                        else
                        {
                            //Update UpdateId, UpdateDt here
                            if (_userPrincipalService.IsAuthenticated)
                                entity.UpdateId = _userPrincipalService.UserId.ToString();

                            entity.UpdateTime = DateTime.Now;
                        }
                    }
                }
            }
            catch
            {
                //Ignore
            }
            return await base.SaveChangesAsync(true, cancellationToken);
        }
        #endregion
        #region Declare entity here
        public DbSet<SysUser> SysUser { get; set; }
        public DbSet<SysUserCommand> SysUserCommand { get; set; }
        public DbSet<SysRole> SysRole { get; set; }
        public DbSet<SysCommand> SysCommand { get; set; }
        public DbSet<SysUserRole> SysUserRole { get; set; }
        public DbSet<SysRoleCommand> SysRoleCommand { get; set; }
        public DbSet<OrganizationUnit> ErpUnits { get; set; }
        public DbSet<Plant> ErpPlants { get; set; }
        public DbSet<UserPlantAccess> ErpUserPlants { get; set; }
        public DbSet<UserUnitAccess> ErpUserUnits { get; set; }
        public DbSet<ErpNotification> ErpNotifications { get; set; }
        public DbSet<ErpNotificationRead> ErpNotificationReads { get; set; }
        public DbSet<ErpSetting> ErpSettings { get; set; }
        #endregion
    }
}
