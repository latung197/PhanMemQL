using Core.Application.Security;
using Core.Infrastructure.ContextAccessors;
using Core.Infrastructure.Security;
using Core.Application.Features.Erp.Auth;
using Core.Application.Features.Erp.Organization;
using Core.Application.Features.Erp.Menu;
using Core.Application.Features.Erp.Notifications;
using Core.Application.Features.Erp.Settings;
using Core.Infrastructure.Features.Erp.Auth;
using Core.Infrastructure.Features.Erp.Organization;
using Core.Infrastructure.Features.Erp.Menu;
using Core.Infrastructure.Features.Erp.Notifications;
using Core.Infrastructure.Features.Erp.Settings;
using Core.Infrastructure.Bootstrap;
using Core.Application.Features.Erp.Users;
using Core.Infrastructure.Features.Erp.Users;
using Microsoft.Extensions.DependencyInjection;

namespace Core.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddCoreInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IUserPrincipalService, UserPrincipalService>();
        services.AddScoped<IAccessControlService, AccessControlService>();
        services.AddSingleton<IPasswordService, PasswordService>();
        services.AddScoped<IErpAuthService, ErpAuthService>();
        services.AddScoped<IOrganizationService, OrganizationService>();
        services.AddScoped<IMenuService, MenuService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<ISettingService, SettingService>();
        services.AddScoped<IFrontendSystemConfigService, FrontendSystemConfigService>();
        services.AddScoped<AdminBootstrapper>();
        services.AddScoped<IUserManagementService, UserManagementService>();
        return services;
    }
}
