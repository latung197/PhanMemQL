using Core.Common.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Core.Common.Extensions;

/// <summary>Swagger UI (Development only): lists the endpoints, with the rights each one needs, and lets you try them with a JWT.</summary>
public static class SwaggerExtensions
{
    private const string BearerScheme = "Bearer";

    public static IServiceCollection AddSwagger(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(o =>
        {
            o.SwaggerDoc("v1", new OpenApiInfo { Title = "S-ERP API", Version = "v1" });
            o.AddSecurityDefinition(BearerScheme, new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                Description = "Lấy token ở POST /api/auth/login rồi dán vào đây (không cần chữ Bearer)."
            });
            o.AddSecurityRequirement(document => new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference(BearerScheme, document)] = []
            });
            o.OperationFilter<RequiredRightsFilter>();
            o.CustomSchemaIds(type => type.FullName?.Replace('+', '.'));
        });
        return services;
    }

    public static WebApplication UseSwaggerInDevelopment(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment()) return app;
        app.UseSwagger();
        app.UseSwaggerUI(o =>
        {
            o.SwaggerEndpoint("/swagger/v1/swagger.json", "S-ERP API v1");
            o.DisplayRequestDuration();
        });
        return app;
    }

    /// <summary>Writes the rights from [RequirePermission] / [RequireRight] into each operation's description.</summary>
    private sealed class RequiredRightsFilter : IOperationFilter
    {
        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            var policies = context.MethodInfo.GetCustomAttributes(true).Concat(context.MethodInfo.DeclaringType?.GetCustomAttributes(true) ?? [])
                .OfType<AuthorizeAttribute>().Select(a => a.Policy).Where(p => p != null).Distinct().ToList();
            // Catalog controllers (CatalogControllerBase) declare their rights with attributes instead of policies.
            var catalogFunction = context.MethodInfo.DeclaringType is null ? null
                : context.ApiDescription.ActionDescriptor is Microsoft.AspNetCore.Mvc.Controllers.ControllerActionDescriptor action
                    ? action.ControllerTypeInfo.GetCustomAttributes(typeof(CatalogFunctionAttribute), true)
                        .Cast<CatalogFunctionAttribute>().FirstOrDefault()?.Function : null;
            var catalogRights = catalogFunction is null ? [] : context.MethodInfo.GetCustomAttributes(typeof(CatalogRightAttribute), true)
                .Cast<CatalogRightAttribute>().Select(a => $"Quyền {catalogFunction}:{a.Action}").ToList();
            var rights = policies
                .Select(p => p!.StartsWith(Policies.PermissionPrefix) ? "Quyền " + p[Policies.PermissionPrefix.Length..]
                    : p.StartsWith(Policies.RightPrefix) ? "Quyền đặc biệt " + p[Policies.RightPrefix.Length..] : null)
                .Where(p => p != null).ToList();
            rights.AddRange(catalogRights);
            if (rights.Count == 0) return;
            var text = "**Cần:** " + string.Join(", ", rights.Select(r => $"`{r}`"));
            operation.Description = string.IsNullOrEmpty(operation.Description) ? text : operation.Description + "\n\n" + text;
        }
    }
}
