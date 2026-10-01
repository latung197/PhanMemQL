using Core.Application.Common.Auditing;
using Core.Application.Common.Persistence;
using Core.Application.Common.Security;
using Core.Application.Modules.Approvals;
using Core.Application.Modules.Auth;
using Core.Application.Modules.CompanyUnits;
using Core.Application.Modules.Currencies;
using Core.Application.Modules.Departments;
using Core.Application.Modules.Fiscal;
using Core.Application.Modules.Inventory;
using Core.Application.Modules.Languages;
using Core.Application.Modules.Notifications;
using Core.Application.Modules.Roles;
using Core.Application.Modules.SystemConfig;
using Core.Application.Modules.Users;
using Core.Application.Modules.VoucherNumbering;
using Core.Infrastructure.Common.Auditing;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Common.Persistence.Sql;
using Core.Infrastructure.Common.Security;
using Core.Infrastructure.Common.Seeding;
using Core.Infrastructure.Modules.Approvals;
using Core.Infrastructure.Modules.Auth;
using Core.Infrastructure.Modules.CompanyUnits;
using Core.Infrastructure.Modules.Currencies;
using Core.Infrastructure.Modules.Departments;
using Core.Infrastructure.Modules.Fiscal;
using Core.Infrastructure.Modules.Inventory;
using Core.Infrastructure.Modules.Languages;
using Core.Infrastructure.Modules.Notifications;
using Core.Infrastructure.Modules.Roles;
using Core.Infrastructure.Modules.SystemConfig;
using Core.Infrastructure.Modules.Users;
using Core.Infrastructure.Modules.VoucherNumbering;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Core.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Common
        services.AddDbContext<CoreContext>(o => o.UseNpgsql(configuration.GetConnectionString("CoreContext")));
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, CurrentUser>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<AuditTrail>();
        services.AddScoped<IAuditLog, AuditLogService>();
        services.AddScoped<ISqlExecutor, SqlExecutor>();
        services.AddSingleton<IPasswordService, PasswordService>();
        services.AddSingleton(JwtOptions.FromConfiguration(configuration));
        services.AddSingleton<ITokenService, JwtTokenService>();
        services.AddScoped<DatabaseSeeder>();

        // Modules
        services.AddScoped<UserProfileBuilder>();
        services.AddScoped<UserAccessWriter>();
        services.AddScoped<UserAccessAudit>();
        services.AddScoped<GrantGuard>();
        services.AddScoped<IPermissionService, PermissionService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IRoleService, RoleService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ICompanyUnitService, CompanyUnitService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddSingleton<INotificationStream, NotificationStream>();
        services.AddHostedService<NotificationCleanupService>();
        services.AddScoped<ISystemConfigService, SystemConfigService>();
        services.AddScoped<ApprovalResolver>();
        services.AddScoped<IApprovalRuleService, ApprovalRuleService>();
        services.AddScoped<IDocumentApprovalService, DocumentApprovalService>();
        services.AddScoped<IDepartmentService, DepartmentService>();
        services.AddScoped<ICurrencyService, CurrencyService>();
        services.AddScoped<IExchangeRateService, ExchangeRateService>();
        services.AddScoped<IFiscalPeriodService, FiscalPeriodService>();
        services.AddScoped<IVoucherNumberService, VoucherNumberService>();
        services.AddScoped<ISettingsBackupService, SettingsBackupService>();
        services.AddScoped<ISystemParameters, SystemParametersService>();
        services.AddScoped<ILanguageService, LanguageService>();
        services.AddScoped<IUomService, UomService>();
        return services;
    }
}
