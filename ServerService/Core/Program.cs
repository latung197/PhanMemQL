using Core.Application.Common.Localization;
using Core.Common.Extensions;
using Core.Infrastructure;
using Core.Infrastructure.Common.Seeding;
using Microsoft.Extensions.Hosting.WindowsServices;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = WindowsServiceHelpers.IsWindowsService() ? AppContext.BaseDirectory : default
});

// Secrets live in appsettings.Local.json (not committed); environment and command line still win.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables().AddCommandLine(args);
builder.Host.UseWindowsService();

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApi(builder.Configuration);

var app = builder.Build();

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
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
