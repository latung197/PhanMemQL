using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Core.Application.Common.Security;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Errors;
using Core.Infrastructure.Common.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace Core.Common.Extensions;

/// <summary>Web API setup shared by every module: controllers, JWT, policies, CORS and rate limits.</summary>
public static class ApiServiceExtensions
{
    public const string LoginRateLimit = "login";

    public static IServiceCollection AddApi(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddProblemDetails();
        services.AddControllers(o => o.Filters.Add<AppExceptionFilter>())
            // Enums travel as their names ("Draft", "Pending"...), as the frontend types spell them.
            .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
            .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = _ =>
                ErrorResponse.Create(StatusCodes.Status400BadRequest, "Dữ liệu gửi lên không hợp lệ."));

        services.AddJwtAuthentication(JwtOptions.FromConfiguration(configuration));
        services.AddPermissionAuthorization();
        services.AddFrontendCors(configuration);
        services.AddLoginRateLimit();
        return services;
    }

    private static void AddJwtAuthentication(this IServiceCollection services, JwtOptions jwt)
    {
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
        {
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidIssuer = jwt.Issuer,
                ValidAudience = jwt.Audience,
                IssuerSigningKey = jwt.SigningKey,
                NameClaimType = ErpClaimTypes.UserName,
                ClockSkew = TimeSpan.Zero
            };
            // A token stops working as soon as the account is locked or its password changes.
            o.Events = new JwtBearerEvents
            {
                OnTokenValidated = async context =>
                {
                    var principal = context.Principal!;
                    if (!int.TryParse(principal.FindFirstValue(ErpClaimTypes.SecurityVersion), out var version)
                        || !await context.HttpContext.RequestServices.GetRequiredService<IPermissionService>()
                            .IsTokenCurrentAsync(principal.GetUserId(), version, context.HttpContext.RequestAborted))
                        context.Fail("Phiên đăng nhập đã hết hiệu lực.");
                }
            };
        });
    }

    private static void AddPermissionAuthorization(this IServiceCollection services)
    {
        services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
        services.AddScoped<IAuthorizationHandler, UnitAccessHandler>();
        services.AddScoped<IAuthorizationHandler, AdminHandler>();
        services.AddScoped<IAuthorizationHandler, PermissionHandler>();
        services.AddScoped<IAuthorizationHandler, SpecialRightHandler>();
        services.AddAuthorizationBuilder()
            .AddPolicy(Policies.UnitAccess, p => p.RequireAuthenticatedUser().AddRequirements(new UnitAccessRequirement()))
            .AddPolicy(Policies.Admin, p => p.RequireAuthenticatedUser()
                .AddRequirements(new UnitAccessRequirement(), new AdminRequirement()));
    }

    private static void AddFrontendCors(this IServiceCollection services, IConfiguration configuration)
    {
        var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? ["http://localhost:3000", "http://127.0.0.1:3000"];
        services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));
    }

    private static void AddLoginRateLimit(this IServiceCollection services)
    {
        services.AddRateLimiter(o =>
        {
            o.OnRejected = async (context, ct) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                await context.HttpContext.Response.WriteAsJsonAsync(
                    new { message = "Bạn thử quá nhiều lần. Vui lòng đợi 1 phút rồi thử lại." }, ct);
            };
            o.AddPolicy(LoginRateLimit, context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
        });
    }
}
