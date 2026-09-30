using System.Text.Json;
using Core.Application.Common.Permissions;
using Core.Application.Common.Security;
using Core.Application.Modules.CompanyUnits;
using Core.Application.Modules.SystemConfig;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Notifications;
using Core.Domain.Modules.SystemConfig;
using Core.Domain.Modules.Users;
using Core.Infrastructure.Common.Persistence;
using Core.Infrastructure.Modules.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Core.Infrastructure.Common.Seeding;

/// <summary>
/// Runs at startup. Always inserts missing function codes into sys_command. When sys_users is empty it
/// imports the demo data (Seed:DemoData = true) or creates only the first administrator (Bootstrap:*).
/// </summary>
public sealed class DatabaseSeeder(CoreContext db, IPasswordService passwords, UserAccessWriter access,
    IConfiguration configuration, IHostEnvironment environment, ILogger<DatabaseSeeder> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task RunAsync(CancellationToken ct = default)
    {
        await EnsureFunctionCatalogAsync(ct);
        if (!await db.Users.AnyAsync(ct))
        {
            if (configuration.GetValue<bool>("Seed:DemoData")) await SeedDemoDataAsync(ct);
            else if (!string.IsNullOrEmpty(configuration["Bootstrap:AdminPassword"])) await CreateFirstAdminAsync(ct);
            else logger.LogWarning("Chưa có tài khoản nào. Cấu hình Seed:DemoData hoặc Bootstrap:AdminPassword.");
        }
        await EnsureInitialSpecialRightsAsync(ct);
        await ResetDevAdminPasswordAsync(ct);
    }

    /// <summary>
    /// First start after special rights were added: grants them from the existing matrices
    /// (SpecialRightCatalog.InitialFor) so prices and other users' documents stay visible as before.
    /// </summary>
    private async Task EnsureInitialSpecialRightsAsync(CancellationToken ct)
    {
        if (await db.RoleRights.AnyAsync(ct) || await db.UserRights.AnyAsync(ct) || !await db.Users.AnyAsync(ct)) return;
        var roleGrants = await db.RoleCommands.AsNoTracking().Where(x => x.Status == "1").ToListAsync(ct);
        foreach (var role in roleGrants.GroupBy(x => x.RoleId))
            foreach (var right in SpecialRightCatalog.InitialFor(role.ToDictionary(x => x.MenuId0, x => x.ToActions())))
                db.RoleRights.Add(new SysRoleRight { RoleId = role.Key, MenuId0 = right.Function, RightCode = right.Code });
        var userGrants = await db.UserCommands.AsNoTracking().Where(x => x.Status == "1").ToListAsync(ct);
        foreach (var user in userGrants.GroupBy(x => x.UserId))
            foreach (var right in SpecialRightCatalog.InitialFor(user.ToDictionary(x => x.MenuId0, x => x.ToActions())))
                db.UserRights.Add(new SysUserRight { UserId = user.Key, MenuId0 = right.Function, RightCode = right.Code });
        var count = await db.SaveChangesAsync(ct);
        logger.LogInformation("Đã cấp {Count} quyền đặc biệt ban đầu theo ma trận quyền hiện có.", count);
    }

    /// <summary>
    /// Development only: keeps the "admin" account on Seed:AdminPassword (e.g. admin/admin) so developers
    /// always have a known login. The password policy is not applied here, and the setting is ignored
    /// outside the Development environment.
    /// </summary>
    private async Task ResetDevAdminPasswordAsync(CancellationToken ct)
    {
        var password = configuration["Seed:AdminPassword"];
        if (string.IsNullOrEmpty(password)) return;
        if (!environment.IsDevelopment())
        {
            logger.LogWarning("Bỏ qua Seed:AdminPassword vì môi trường không phải Development.");
            return;
        }
        var admin = await db.Users.FirstOrDefaultAsync(x => x.UserName == "admin" && x.ValidFlg == 1, ct);
        if (admin is null || passwords.Verify(admin, password, out _)) return;
        admin.PasswordHash = passwords.Hash(admin, password);
        admin.IsActive = true;
        admin.EnableFl = 1;
        admin.SecurityVersion++;
        await db.SaveChangesAsync(ct);
        logger.LogWarning("Development: đã đặt mật khẩu tài khoản admin theo Seed:AdminPassword.");
    }

    private async Task EnsureFunctionCatalogAsync(CancellationToken ct)
    {
        var existing = await db.Commands.Select(x => x.MenuId0).ToListAsync(ct);
        foreach (var (code, label) in FunctionCatalog.Functions.Where(x => !existing.Contains(x.Key)))
            db.Commands.Add(new SysCommand { MenuId0 = code, MenuId = code, Text = label, Type = "M" });
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedDemoDataAsync(CancellationToken ct)
    {
        var password = configuration["Seed:DefaultPassword"];
        PasswordPolicy.Validate(password);
        var path = Path.Combine(environment.ContentRootPath, configuration["Seed:File"] ?? "SeedData/seed.json");
        await using var stream = File.OpenRead(path);
        var seed = await JsonSerializer.DeserializeAsync<SeedDataFile>(stream, JsonOptions, ct)
            ?? throw new InvalidOperationException($"Không đọc được dữ liệu mẫu {path}.");

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var units = await SeedCompanyUnitsAsync(seed.CompanyUnits, ct);
        var roles = await SeedRolesAsync(seed.Roles, ct);
        await SeedUsersAsync(seed.Users, roles, units, password!, ct);
        SeedNotifications(seed.Notifications);
        SeedSystemConfig(seed.SystemConfig);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        logger.LogInformation("Đã nạp dữ liệu mẫu: {Units} đơn vị, {Roles} vai trò, {Users} người dùng.",
            units.Count, roles.Count, seed.Users.Count);
    }

    private async Task<List<CompanyUnit>> SeedCompanyUnitsAsync(List<SaveCompanyUnitRequest> items, CancellationToken ct)
    {
        var units = await db.CompanyUnits.ToListAsync(ct);
        var order = units.Count;
        foreach (var item in items.Where(item => units.All(u => u.Code != item.Code)))
        {
            var unit = new CompanyUnit
            {
                Code = item.Code, Name = item.Name, ShortName = item.ShortName, Address = item.Address,
                Phone = item.Phone, Email = item.Email, TaxCode = item.TaxCode,
                IsActive = item.Status != CompanyUnitStatus.Paused, IsDefault = item.IsDefault, SortOrder = ++order
            };
            db.CompanyUnits.Add(unit);
            units.Add(unit);
        }
        await db.SaveChangesAsync(ct);
        return units;
    }

    /// <returns>Seed role id (e.g. ROLE_ADMIN) to database role.</returns>
    private async Task<Dictionary<string, SysRole>> SeedRolesAsync(List<SeedRole> items, CancellationToken ct)
    {
        var map = new Dictionary<string, SysRole>(StringComparer.Ordinal);
        foreach (var item in items)
        {
            var role = await db.Roles.Include(x => x.Permissions).FirstOrDefaultAsync(x => x.RoleCode == item.Code, ct);
            if (role is null)
            {
                db.Roles.Add(role = new SysRole { RoleCode = item.Code, RoleName = item.Name, Description = item.Description });
                if (!role.IsAdmin)
                    foreach (var (code, actions) in Known(item.Permissions))
                    {
                        var row = new SysRoleCommand { MenuId0 = code };
                        row.SetActions(actions);
                        role.Permissions.Add(row);
                    }
            }
            map[item.Id] = role;
        }
        await db.SaveChangesAsync(ct);
        return map;
    }

    private async Task SeedUsersAsync(List<SeedUser> items, Dictionary<string, SysRole> roles,
        List<CompanyUnit> units, string password, CancellationToken ct)
    {
        var defaultUnit = units.FirstOrDefault(x => x.IsDefault)?.Code ?? units.First().Code;
        var adminRole = roles.Values.FirstOrDefault(x => x.IsAdmin);
        foreach (var item in items)
        {
            var user = new SysUser
            {
                UserName = item.Username.Trim().ToLowerInvariant(), FullName = item.FullName,
                Email = item.Email, Phone = item.Phone, Department = item.Department ?? string.Empty,
                Avatar = item.Avatar ?? string.Empty, ThemePref = item.ThemePref is "dark" ? "dark" : "light",
                NotificationsEnabled = item.NotificationsEnabled, EmployeeCode = item.Id,
                MaDvcs = item.MaDvcs ?? defaultUnit
            };
            user.PasswordHash = passwords.Hash(user, password);
            db.Users.Add(user);
            await db.SaveChangesAsync(ct);

            // Demo users may work in every unit unless the mock lists them.
            var allowed = item.DsMaDvcs is { Count: > 0 } list ? list : units.Select(x => x.Code).ToList();
            await access.ReplaceUnitsAsync(user.UserId, allowed.Append(user.MaDvcs).Distinct().ToList(), ct);
            var role = item.IsSystemAdmin ? adminRole
                : item.RoleId is not null && roles.TryGetValue(item.RoleId, out var mapped) ? mapped : null;
            await access.ReplaceRoleAsync(user.UserId, role, ct);
            if (role?.IsAdmin != true)
                await access.ReplaceMatrixAsync(user.UserId, item.Permissions is null ? RoleMatrix(role)
                    : Known(item.Permissions).ToDictionary(x => x.Key, x => x.Value), ct);
        }
        await db.SaveChangesAsync(ct);
    }

    private void SeedNotifications(List<SeedNotification> items)
    {
        var now = DateTime.UtcNow;
        db.Notifications.AddRange(items.Select((item, index) => new Notification
        {
            Title = item.Title, Body = item.Message,
            Type = Notification.Types.Contains(item.Type) ? item.Type! : "info",
            LinkModule = item.LinkModule is { } module && FunctionCatalog.ModuleKeys.Contains(module) ? module : null,
            CreatedAtUtc = now.AddMinutes(-15 * index), CreatedByUserId = 0
        }));
    }

    private void SeedSystemConfig(Dictionary<string, JsonElement> sections)
    {
        foreach (var (section, value) in sections)
        {
            var name = SystemConfigSections.Validate(section, value);
            db.SystemSettings.Add(new SystemSetting
            {
                Key = SystemConfigSections.Keys[name], Scope = SystemSetting.GlobalScope, Value = value.GetRawText(),
                IsPublic = true, UpdatedAtUtc = DateTime.UtcNow, UpdatedByUserId = 0
            });
        }
    }

    private async Task CreateFirstAdminAsync(CancellationToken ct)
    {
        var password = configuration["Bootstrap:AdminPassword"];
        if (string.IsNullOrEmpty(password) || password.Length < 12)
            throw new InvalidOperationException("Bootstrap:AdminPassword phải có ít nhất 12 ký tự.");
        var unitCode = configuration["Bootstrap:UnitCode"]?.Trim() is { Length: > 0 } code ? code : "DVCS01";

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (!await db.CompanyUnits.AnyAsync(x => x.Code == unitCode, ct))
            db.CompanyUnits.Add(new CompanyUnit
            {
                Code = unitCode, Name = configuration["Bootstrap:UnitName"] ?? "Đơn vị cơ sở chính", IsDefault = true
            });
        var role = await db.Roles.FirstOrDefaultAsync(x => x.RoleCode == SysRole.AdminCode, ct);
        if (role is null) db.Roles.Add(role = new SysRole { RoleCode = SysRole.AdminCode, RoleName = "Quản trị hệ thống" });
        var user = new SysUser
        {
            UserName = (configuration["Bootstrap:AdminUsername"] ?? "admin").Trim().ToLowerInvariant(),
            FullName = "Quản trị hệ thống", MaDvcs = unitCode, EmployeeCode = "ADMIN"
        };
        user.PasswordHash = passwords.Hash(user, password);
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        await access.ReplaceRoleAsync(user.UserId, role, ct);
        await access.ReplaceUnitsAsync(user.UserId, [unitCode], ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        logger.LogInformation("Đã tạo tài khoản quản trị đầu tiên {User}.", user.UserName);
    }

    private static IEnumerable<KeyValuePair<string, ActionPermissions>> Known(Dictionary<string, ActionPermissions>? matrix) =>
        (matrix ?? []).Where(x => FunctionCatalog.IsFunction(x.Key));

    private static Dictionary<string, ActionPermissions>? RoleMatrix(SysRole? role) =>
        role is null ? null : role.Permissions.ToDictionary(x => x.MenuId0, x => x.ToActions());
}
