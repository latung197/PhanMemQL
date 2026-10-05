using System.Text.Json;
using Core.Application.Common.Documents;
using Core.Application.Common.Permissions;
using Core.Application.Common.Security;
using Core.Application.Modules.CompanyUnits;
using Core.Application.Modules.Currencies;
using Core.Application.Modules.Departments;
using Core.Application.Modules.SystemConfig;
using Core.Domain.Modules.CompanyUnits;
using Core.Domain.Modules.Currencies;
using Core.Domain.Modules.Departments;
using Core.Domain.Modules.Languages;
using Core.Domain.Modules.Notifications;
using Core.Domain.Modules.SystemConfig;
using Core.Domain.Modules.Users;
using Core.Domain.Modules.VoucherNumbering;
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
        await EnsureMenuTreeAsync(ct);
        if (!await db.Users.AnyAsync(ct))
        {
            if (configuration.GetValue<bool>("Seed:DemoData")) await SeedDemoDataAsync(ct);
            else if (!string.IsNullOrEmpty(configuration["Bootstrap:AdminPassword"])) await CreateFirstAdminAsync(ct);
            else logger.LogWarning("Chưa có tài khoản nào. Cấu hình Seed:DemoData hoặc Bootstrap:AdminPassword.");
        }
        await EnsureInitialSpecialRightsAsync(ct);
        await EnsureVoucherNumberingAsync(ct);
        await EnsureBaseCurrencyAsync(ct);
        await EnsureDefaultLanguageAsync(ct);
        await ResetDevAdminPasswordAsync(ct);
    }

    /// <summary>
    /// Creates the number series of vouchers added to VoucherCatalog. Older databases kept the series in the
    /// systemDefaults setting (autoNumbering); their prefix, pattern and digits are taken over.
    /// </summary>
    private async Task EnsureVoucherNumberingAsync(CancellationToken ct)
    {
        var existing = await db.VoucherNumberingRules.Select(x => x.VoucherType).ToListAsync(ct);
        var missing = VoucherCatalog.All.Where(x => !existing.Contains(x.VoucherType)).ToList();
        if (missing.Count == 0) return;

        var legacy = await db.SystemSettings.AsNoTracking()
            .Where(x => x.Key == SystemConfigSections.Keys["systemDefaults"] && x.Scope == SystemSetting.GlobalScope)
            .Select(x => x.Value).FirstOrDefaultAsync(ct);
        JsonElement autoNumbering = default;
        if (legacy is not null)
        {
            using var document = JsonDocument.Parse(legacy);
            if (document.RootElement.TryGetProperty("autoNumbering", out var value)) autoNumbering = value.Clone();
        }

        foreach (var voucher in missing)
        {
            var rule = new VoucherNumberingRule
            {
                VoucherType = voucher.VoucherType, MenuId0 = voucher.Function, Name = voucher.Name,
                Prefix = voucher.VoucherType, Pattern = VoucherCatalog.DefaultPattern, Digits = VoucherCatalog.DefaultDigits
            };
            if (autoNumbering.ValueKind == JsonValueKind.Object && autoNumbering.TryGetProperty(voucher.VoucherType, out var old))
            {
                if (old.TryGetProperty("prefix", out var prefix) && prefix.GetString() is { Length: > 0 } p) rule.Prefix = p;
                if (old.TryGetProperty("pattern", out var pattern) && pattern.GetString() is { } text && text.Contains("{SEQ}")) rule.Pattern = text;
                if (old.TryGetProperty("digits", out var digits) && digits.TryGetInt16(out var d) && d is >= 1 and <= 10) rule.Digits = d;
            }
            db.VoucherNumberingRules.Add(rule);
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Vouchers need a base currency; a new database starts with VND.</summary>
    private async Task EnsureBaseCurrencyAsync(CancellationToken ct)
    {
        if (await db.Currencies.AnyAsync(x => x.IsBase, ct)) return;
        var vnd = await db.Currencies.FirstOrDefaultAsync(x => x.Code == "VND", ct);
        if (vnd is null) db.Currencies.Add(new Currency { Code = "VND", Name = "Việt Nam Đồng", Symbol = "₫", DecimalPlaces = 0, IsBase = true });
        else vnd.IsBase = vnd.IsActive = true;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Users need a default language; a new database starts with Vietnamese (default) and English.</summary>
    private async Task EnsureDefaultLanguageAsync(CancellationToken ct)
    {
        if (await db.Languages.AnyAsync(x => x.IsDefault, ct)) return;
        var vi = await db.Languages.FirstOrDefaultAsync(x => x.Code == Language.Vietnamese, ct);
        if (vi is null) db.Languages.Add(new Language { Code = Language.Vietnamese, Name = "Tiếng Việt", NativeName = "Tiếng Việt", IsDefault = true, SortOrder = 1 });
        else vi.IsDefault = vi.IsActive = true;
        if (!await db.Languages.AnyAsync(x => x.Code == "en", ct))
            db.Languages.Add(new Language { Code = "en", Name = "Tiếng Anh", NativeName = "English", SortOrder = 2 });
        await db.SaveChangesAsync(ct);
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
        // Users with matrix exceptions: the rights their own matrix calls for, stored as exceptions to the role's.
        var userGrants = await db.UserCommands.AsNoTracking().Where(x => x.Status == "1").ToListAsync(ct);
        var userRoles = await db.UserRoles.AsNoTracking().Where(x => x.Status == "1").ToListAsync(ct);
        foreach (var user in userGrants.GroupBy(x => x.UserId))
        {
            var roleIds = userRoles.Where(x => x.UserId == user.Key).Select(x => x.RoleId).ToHashSet();
            var fromRoles = roleGrants.Where(x => roleIds.Contains(x.RoleId)).Select(x => (x.MenuId0, x.ToActions())).ToList();
            var roleMatrix = PermissionMatrix.Build(fromRoles);
            var effective = PermissionMatrix.Resolve(false, user.Select(x => (x.MenuId0, x.ToActions())).ToList(), fromRoles);
            static IEnumerable<string> Keys(IEnumerable<SpecialRightDefinition> rights) =>
                rights.Select(r => SpecialRightCatalog.Key(r.Function, r.Code));
            var (granted, denied) = PermissionMatrix.RightOverrides(Keys(SpecialRightCatalog.InitialFor(roleMatrix)),
                Keys(SpecialRightCatalog.InitialFor(effective)));
            await access.ReplaceRightOverridesAsync(user.Key, granted, denied, ct);
        }
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

    /// <summary>Populate sys_command menu fields once; later changes to the database are never overwritten.</summary>
    private async Task EnsureMenuTreeAsync(CancellationToken ct)
    {
        if (await db.Commands.AnyAsync(x => x.MenuKind != null, ct)) return;
        var path = Path.Combine(environment.ContentRootPath, "SeedData", "menu.json");
        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(path, ct));
        var functions = await db.Commands.ToDictionaryAsync(x => x.MenuId0, StringComparer.Ordinal, ct);

        static string? Optional(JsonElement item, string name) =>
            item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
        static int Order(JsonElement item) => item.TryGetProperty("orderNo", out var value) ? value.GetInt32() : 0;
        static bool Active(JsonElement item) => !item.TryGetProperty("isActive", out var value) || value.GetBoolean();
        void AddNode(JsonElement item, string? parentId, string kind, string code)
        {
            var id = kind == "function" ? code : item.GetProperty("id").GetString()!;
            if (!functions.TryGetValue(id, out var row))
            {
                row = new SysCommand { MenuId0 = id, MenuId = id, Type = "M" };
                db.Commands.Add(row);
            }
            row.Text = item.GetProperty("titleVi").GetString()!;
            row.Text2 = item.GetProperty("titleEn").GetString()!;
            row.MenuKind = kind;
            row.MenuKey = code;
            row.MenuParentId = parentId;
            row.MenuIcon = Optional(item, "icon") ?? "";
            row.MenuIconColor = Optional(item, "iconColor");
            row.MenuBadgeType = Optional(item, "badgeType");
            row.MenuDirectFunctionCode = Optional(item, "directSubKey");
            row.MenuOrderNo = Order(item);
            row.MenuIsActive = Active(item);
            db.CommandTranslations.Add(new SysCommandTranslation { MenuId0 = id, LanguageCode = "vi", Title = row.Text });
            db.CommandTranslations.Add(new SysCommandTranslation { MenuId0 = id, LanguageCode = "en", Title = row.Text2 });
        }

        foreach (var module in document.RootElement.EnumerateArray())
        {
            var moduleId = module.GetProperty("id").GetString()!;
            AddNode(module, null, "module", module.GetProperty("key").GetString()!);
            if (!module.TryGetProperty("subGroups", out var groups)) continue;
            foreach (var group in groups.EnumerateArray())
            {
                var groupId = group.GetProperty("id").GetString()!;
                AddNode(group, moduleId, "group", group.GetProperty("groupCode").GetString()!);
                foreach (var item in group.GetProperty("items").EnumerateArray())
                    AddNode(item, groupId, "function", item.GetProperty("subKey").GetString()!);
            }
        }
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
        var departments = await SeedDepartmentsAsync(seed.Departments, ct);
        await SeedUsersAsync(seed.Users, roles, units, departments, password!, ct);
        SeedNotifications(seed.Notifications);
        SeedSystemConfig(seed.SystemConfig);
        await SeedCurrenciesAsync(seed.Currencies, seed.ExchangeRates, ct);
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

    private async Task<List<Department>> SeedDepartmentsAsync(List<SaveDepartmentRequest> items, CancellationToken ct)
    {
        var departments = await db.Departments.ToListAsync(ct);
        foreach (var item in items.Where(item => departments.All(d => d.Code != item.Code)))
        {
            var department = new Department
            {
                Code = item.Code, Name = item.Name, Note = item.Note, IsActive = item.IsActive, SortOrder = departments.Count + 1
            };
            db.Departments.Add(department);
            departments.Add(department);
        }
        await db.SaveChangesAsync(ct);
        return departments;
    }

    private async Task SeedCurrenciesAsync(List<SaveCurrencyRequest> currencies, List<SaveExchangeRateRequest> rates,
        CancellationToken ct)
    {
        if (await db.Currencies.AnyAsync(ct)) return;
        var order = 0;
        foreach (var item in currencies)
            db.Currencies.Add(new Currency
            {
                Code = item.Code, Name = item.Name, Symbol = item.Symbol ?? string.Empty, DecimalPlaces = (short)item.DecimalPlaces,
                IsBase = item.IsBase, IsActive = item.IsActive, SortOrder = ++order
            });
        db.ExchangeRates.AddRange(rates.Where(r => currencies.Any(c => c.Code == r.CurrencyCode && !c.IsBase))
            .Select(r => new ExchangeRate
            {
                CurrencyCode = r.CurrencyCode, RateDate = r.Date, BuyRate = r.BuyRate, SellRate = r.SellRate,
                AccountingRate = r.AccountingRate, UpdatedAtUtc = DateTime.UtcNow, UpdatedByUserId = 0
            }));
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedUsersAsync(List<SeedUser> items, Dictionary<string, SysRole> roles,
        List<CompanyUnit> units, List<Department> departments, string password, CancellationToken ct)
    {
        var defaultUnit = units.FirstOrDefault(x => x.IsDefault)?.Code ?? units.First().Code;
        var adminRole = roles.Values.FirstOrDefault(x => x.IsAdmin);
        foreach (var item in items)
        {
            var department = departments.FirstOrDefault(d => d.Code == item.DepartmentCode);
            var user = new SysUser
            {
                UserName = item.Username.Trim().ToLowerInvariant(), FullName = item.FullName,
                Email = item.Email, Phone = item.Phone,
                DepartmentCode = department?.Code, Department = department?.Name ?? item.Department ?? string.Empty,
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
            // A mock user matrix is the whole wanted matrix (missing functions = no rights); only what
            // differs from the role is stored.
            if (role?.IsAdmin != true && item.Permissions is not null)
            {
                var wanted = PermissionMatrix.Uniform(ActionPermissions.None);
                foreach (var (code, actions) in Known(item.Permissions)) wanted[code] = actions;
                await access.ReplaceMatrixOverridesAsync(user.UserId,
                    PermissionMatrix.Overrides(await access.RoleMatrixAsync(role, ct), wanted), ct);
            }
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
}
