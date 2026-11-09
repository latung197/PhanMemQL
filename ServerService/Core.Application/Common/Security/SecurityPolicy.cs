using Core.Application.Common.Exceptions;
using Core.Domain.Modules.Users;

namespace Core.Application.Common.Security;

/// <summary>
/// Sign-in and password rules of the whole system (Settings › Người dùng &amp; phân quyền › Bảo mật đăng nhập, kept as the global setting
/// SECURITY_POLICY; administrators change it). The defaults below apply until it is saved. Accounts are never locked: after
/// <see cref="LoginMaxFailures"/> wrong passwords within <see cref="LoginFailureWindowMinutes"/> the user name has to wait
/// <see cref="LoginBlockMinutes"/>. 0 switches a limit off (expiry, history, failures, idle time).
/// </summary>
public sealed record SecurityPolicy(
    int PasswordMinLength = 8,
    bool PasswordRequireLetter = true,
    bool PasswordRequireDigit = true,
    bool PasswordRequireUpper = false,
    bool PasswordRequireSpecial = false,
    int PasswordExpiryDays = 90,
    int PasswordHistory = 3,
    bool MustChangeAfterReset = true,
    int LoginMaxFailures = 5,
    int LoginFailureWindowMinutes = 15,
    int LoginBlockMinutes = 15,
    int IdleTimeoutMinutes = 30)
{
    public static SecurityPolicy Default { get; } = new();

    /// <summary>Refuses values out of range (BusinessRuleException "security.invalid").</summary>
    public SecurityPolicy Validated()
    {
        static void Range(int value, int min, int max, string field)
        {
            if (value < min || value > max) throw new BusinessRuleException("security.invalid", field, min, max);
        }
        Range(PasswordMinLength, 6, 64, "passwordMinLength");
        Range(PasswordExpiryDays, 0, 3650, "passwordExpiryDays");
        Range(PasswordHistory, 0, 24, "passwordHistory");
        Range(LoginMaxFailures, 0, 100, "loginMaxFailures");
        Range(LoginFailureWindowMinutes, 1, 1440, "loginFailureWindowMinutes");
        Range(LoginBlockMinutes, 1, 1440, "loginBlockMinutes");
        Range(IdleTimeoutMinutes, 0, 1440, "idleTimeoutMinutes");
        return this;
    }

    /// <summary>The first rule the password breaks as (message key, arguments), null when it is acceptable.</summary>
    public (string Key, object[] Args)? PasswordProblem(string? password)
    {
        var text = password ?? string.Empty;
        if (string.IsNullOrWhiteSpace(text) || text.Length < PasswordMinLength) return ("validation.passwordLength", [PasswordMinLength]);
        if (PasswordRequireLetter && !text.Any(char.IsLetter)) return ("security.passwordLetter", []);
        if (PasswordRequireDigit && !text.Any(char.IsDigit)) return ("security.passwordDigit", []);
        if (PasswordRequireUpper && !(text.Any(char.IsUpper) && text.Any(char.IsLower))) return ("security.passwordUpper", []);
        if (PasswordRequireSpecial && text.All(char.IsLetterOrDigit)) return ("security.passwordSpecial", []);
        return null;
    }

    /// <summary>Throws BusinessRuleException when the password breaks a rule.</summary>
    public void EnsurePassword(string? password)
    {
        if (PasswordProblem(password) is { } problem) throw new BusinessRuleException(problem.Key, problem.Args);
    }

    /// <summary>Whether a password set at <paramref name="changedAtUtc"/> is too old (unknown date = not expired).</summary>
    public bool IsPasswordExpired(DateTime? changedAtUtc, DateTime nowUtc) =>
        PasswordExpiryDays > 0 && changedAtUtc is { } changed && nowUtc - changed >= TimeSpan.FromDays(PasswordExpiryDays);

    /// <summary>
    /// Minutes the user name still has to wait, 0 when it may try. <paramref name="failuresUtc"/> are the wrong passwords since the last
    /// successful sign-in: when <see cref="LoginMaxFailures"/> of them fall inside the window, signing in is refused until
    /// <see cref="LoginBlockMinutes"/> after the last one.
    /// </summary>
    public int BlockedMinutes(IReadOnlyCollection<DateTime> failuresUtc, DateTime nowUtc)
    {
        if (LoginMaxFailures <= 0 || failuresUtc.Count == 0) return 0;
        var recent = failuresUtc.Where(x => nowUtc - x <= TimeSpan.FromMinutes(LoginFailureWindowMinutes)).ToList();
        if (recent.Count < LoginMaxFailures) return 0;
        var until = recent.Max().AddMinutes(LoginBlockMinutes);
        return until <= nowUtc ? 0 : (int)Math.Ceiling((until - nowUtc).TotalMinutes);
    }
}

/// <summary>Results written to the login history (sys_login_history.result).</summary>
public static class LoginResults
{
    public const string Success = "SUCCESS", WrongPassword = "WRONG_PASSWORD", UnknownUser = "UNKNOWN_USER",
        UnitDenied = "UNIT_DENIED", Blocked = "BLOCKED", Logout = "LOGOUT", IdleTimeout = "IDLE_TIMEOUT";
    public static readonly string[] All = [Success, WrongPassword, UnknownUser, UnitDenied, Blocked, Logout, IdleTimeout];
}

/// <summary>Reads and saves the policy and applies the password rules that need the database (history of the account).</summary>
public interface ISecurityPolicyService
{
    Task<SecurityPolicy> GetAsync(CancellationToken ct);
    Task<SecurityPolicy> SaveAsync(int userId, SecurityPolicy policy, CancellationToken ct);

    /// <summary>Checks a new password of the account: the rules of the policy, and not one of the last <see cref="SecurityPolicy.PasswordHistory"/>
    /// passwords (the current one included).</summary>
    Task EnsureNewPasswordAsync(SysUser user, string? password, CancellationToken ct);

    /// <summary>Sets the new password: keeps the old one in the history, stamps the change date and whether it must be changed at the next sign-in.</summary>
    Task SetPasswordAsync(SysUser user, string password, bool mustChange, CancellationToken ct);
}
