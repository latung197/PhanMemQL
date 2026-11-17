using Core.Application.Common.Localization;
using Core.Common.Authorization;
using Core.Common.Extensions;
using Core.Common.Monitoring;
using Core.Infrastructure;
using Core.Infrastructure.Common.Seeding;
using Microsoft.Extensions.Hosting.WindowsServices;

// A Windows service starts in System32: relative paths (logs/) are next to the program.
if (WindowsServiceHelpers.IsWindowsService()) Directory.SetCurrentDirectory(AppContext.BaseDirectory);

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = WindowsServiceHelpers.IsWindowsService() ? AppContext.BaseDirectory : default
});

// Secrets live in appsettings.Local.json (not committed); environment and command line still win.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables().AddCommandLine(args);
builder.Host.UseWindowsService();
builder.AddMonitoring();

// Behind a reverse proxy the caller's address arrives in X-Forwarded-For: it is trusted only from the proxies named in
// Network:KnownProxies (a client could otherwise write any address and get around the IP list of an API key).
var knownProxies = builder.Configuration.GetSection("Network:KnownProxies").Get<string[]>() ?? [];
if (knownProxies.Length > 0)
    builder.Services.Configure<Microsoft.AspNetCore.Builder.ForwardedHeadersOptions>(o =>
    {
        o.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor
            | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
        o.KnownProxies.Clear();
        o.KnownNetworks.Clear();
        foreach (var proxy in knownProxies) o.KnownProxies.Add(System.Net.IPAddress.Parse(proxy));
    });

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApi(builder.Configuration);
if (builder.Environment.IsDevelopment()) builder.Services.AddSwagger();

var app = builder.Build();
if (knownProxies.Length > 0) app.UseForwardedHeaders();

using (var scope = app.Services.CreateScope())
    await scope.ServiceProvider.GetRequiredService<DatabaseSeeder>().RunAsync();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler();
    app.UseHsts();
}
// Texts for users (messages, translated names) in the language the browser asks for (Accept-Language).
app.Use(async (context, next) =>
{
    Messages.CurrentLanguage = context.Request.Headers.AcceptLanguage.ToString();
    await next(context);
});
app.UseMonitoring();
app.UseSwaggerInDevelopment();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<ApiClientMiddleware>();
app.UseAuthorization();
app.MapControllers();
app.MapMonitoring();
app.Run();
