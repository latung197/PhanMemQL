using System.Text.Json;
using Core.Common.Authorization;
using Core.Infrastructure.Common.Persistence;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Serilog;
using Serilog.Events;

namespace Core.Common.Monitoring;

/// <summary>
/// Logs and health. Serilog (section "Serilog" of appsettings) writes to the console and to logs/erp-yyyyMMdd.log
/// (one file a day, 30 kept). Every request is logged once with who made it (UserId, UnitCode, ClientIp), its
/// RequestId (also returned in the X-Request-Id header, so a user can quote it) and how long it took; slower than
/// Monitoring:SlowRequestMs is a warning, a server error is an error. Slow SQL: SlowQueryInterceptor.
/// GET /health checks the database (for a load balancer or a monitoring tool); GET /health/live only the process.
/// </summary>
public static class MonitoringExtensions
{
    public static WebApplicationBuilder AddMonitoring(this WebApplicationBuilder builder)
    {
        builder.Host.UseSerilog((context, services, logger) => logger
            .ReadFrom.Configuration(context.Configuration)
            .ReadFrom.Services(services)
            .Enrich.FromLogContext());
        builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);
        return builder;
    }

    public static WebApplication UseMonitoring(this WebApplication app)
    {
        var slowMs = app.Configuration.GetValue("Monitoring:SlowRequestMs", 1000);
        app.Use(async (context, next) =>
        {
            context.Response.Headers["X-Request-Id"] = context.TraceIdentifier;
            await next(context);
        });
        app.UseSerilogRequestLogging(options =>
        {
            options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} → {StatusCode} ({Elapsed:0} ms)";
            options.GetLevel = (context, elapsed, ex) =>
                ex is not null || context.Response.StatusCode >= 500 ? LogEventLevel.Error
                : IsQuiet(context.Request.Path) ? LogEventLevel.Verbose
                : elapsed > slowMs ? LogEventLevel.Warning
                : LogEventLevel.Information;
            options.EnrichDiagnosticContext = (diagnostics, context) =>
            {
                diagnostics.Set("RequestId", context.TraceIdentifier);
                diagnostics.Set("ClientIp", context.Connection.RemoteIpAddress?.ToString());
                if (context.User.Identity?.IsAuthenticated == true)
                {
                    diagnostics.Set("UserId", context.User.GetUserId());
                    diagnostics.Set("UnitCode", context.User.GetUnitCode());
                }
            };
        });
        return app;
    }

    public static WebApplication MapMonitoring(this WebApplication app)
    {
        app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false, ResponseWriter = WriteAsync })
            .AllowAnonymous().DisableRateLimiting();
        app.MapHealthChecks("/health", new HealthCheckOptions { ResponseWriter = WriteAsync })
            .AllowAnonymous().DisableRateLimiting();
        return app;
    }

    /// <summary>Health checks and the notification stream would fill the log; they are logged only at Verbose.</summary>
    private static bool IsQuiet(PathString path) =>
        path.StartsWithSegments("/health") || path.StartsWithSegments("/api/notifications/stream");

    private static Task WriteAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json; charset=utf-8";
        return context.Response.WriteAsync(JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            durationMs = (int)report.TotalDuration.TotalMilliseconds,
            checks = report.Entries.ToDictionary(e => e.Key, e => new
            {
                status = e.Value.Status.ToString(),
                durationMs = (int)e.Value.Duration.TotalMilliseconds,
                error = e.Value.Exception?.Message
            })
        }));
    }
}

/// <summary>The database answers a simple query.</summary>
public sealed class DatabaseHealthCheck(CoreContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            return await db.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Không kết nối được cơ sở dữ liệu.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Không kết nối được cơ sở dữ liệu.", ex);
        }
    }
}
