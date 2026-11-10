# Bảo mật đăng nhập

Tài liệu mô tả các quy tắc bảo vệ tài khoản của S-ERP: chính sách mật khẩu, chặn tạm khi đăng nhập sai nhiều lần, bắt đổi mật khẩu, tự đăng xuất khi không thao tác và lịch sử đăng nhập. Gồm cách hoạt động (mục 1 đến 6), cài đặt chính sách (mục 7), bảng và API (mục 8, 9), cách kiểm tra (mục 10) và giới hạn hiện tại (mục 11).

## 1. Tổng quan

| Quy tắc | Mặc định | Tắt bằng | Ở đâu trong mã |
|---|---|---|---|
| Độ dài tối thiểu của mật khẩu | 8 ký tự | không tắt được (6 đến 64) | `SecurityPolicy.PasswordProblem` |
| Phải có chữ cái / chữ số | có / có | bỏ chọn | như trên |
| Phải có chữ hoa và chữ thường / ký tự đặc biệt | không / không | | như trên |
| Mật khẩu hết hạn sau | 90 ngày | 0 | `SecurityPolicy.IsPasswordExpired` |
| Không dùng lại các mật khẩu gần nhất | 3 mật khẩu (tính cả mật khẩu đang dùng) | 0 | `SecurityPolicyService.EnsureNewPasswordAsync` |
| Bắt đổi mật khẩu sau khi người khác đặt | có | bỏ chọn | `MustChangeAfterReset` |
| Chặn tạm khi đăng nhập sai | sai 5 lần trong 15 phút thì chờ 15 phút | số lần sai = 0 | `SecurityPolicy.BlockedMinutes` |
| Tự đăng xuất khi không thao tác | 30 phút | 0 | `IdleSignOut.tsx`, `SessionActivity` |

Chính sách áp dụng cho **toàn hệ thống** (mọi đơn vị cơ sở), lưu trong `sys_setting` khóa `SECURITY_POLICY`. Chưa lưu lần nào thì dùng giá trị mặc định ở bảng trên. Chỉ **quản trị viên** đổi được chính sách.

**Tài khoản không bao giờ bị khóa** vì đăng nhập sai. Hệ thống chỉ bắt **tên đăng nhập** đó chờ một lúc, để người đoán mật khẩu không thử liên tục được mà chủ tài khoản cũng không phải nhờ quản trị viên mở khóa.

## 2. Quy tắc mật khẩu

Áp dụng mỗi khi đặt mật khẩu mới: người dùng tự đổi (Tài khoản của tôi › Đổi mật khẩu, hoặc màn bắt buộc đổi), quản trị viên tạo tài khoản hoặc đặt lại mật khẩu.

- Kiểm theo thứ tự: độ dài, chữ cái, chữ số, chữ hoa và chữ thường, ký tự đặc biệt; báo lỗi đầu tiên gặp (`validation.passwordLength`, `security.passwordLetter`, `security.passwordDigit`, `security.passwordUpper`, `security.passwordSpecial`).
- Không trùng N mật khẩu gần nhất của chính tài khoản đó (`security.passwordReused`). Hệ thống giữ tối đa 24 mật khẩu cũ (dạng băm) mỗi tài khoản trong `sys_password_history`.
- Dưới ô mật khẩu mới, màn hình liệt kê các quy tắc đang bật (`PasswordRulesHint`, đọc `GET /api/auth/password-rules`).

Mỗi lần đặt mật khẩu, hệ thống ghi thời điểm vào `sys_users.password_changed_at` và đặt cờ `must_change_password`:

| Ai đặt | `must_change_password` |
|---|---|
| Người dùng tự đổi | false |
| Quản trị viên tạo tài khoản hoặc đặt lại mật khẩu | theo chính sách "Bắt đổi mật khẩu sau khi người khác đặt" (mặc định true) |

## 3. Bắt đổi mật khẩu

Khi đăng nhập, nếu `must_change_password` là true **hoặc** mật khẩu đã quá số ngày hết hạn:

1. Đăng nhập vẫn thành công, nhưng token mang claim `erp_pwd_change = 1`.
2. Màn hình chỉ hiện **Cần đổi mật khẩu** (`ForcedPasswordChange.tsx`), có ô đổi mật khẩu và nút Đăng xuất.
3. Máy chủ từ chối mọi API khác bằng 403 `auth.passwordChangeRequired` (`PasswordChangeFilter`). Chỉ các API có `[AllowWhilePasswordChange]` (`GET /api/auth/me`, `PUT /api/auth/me/password`, `GET /api/auth/password-rules`, `POST /api/auth/activity`, `POST /api/auth/logout`) và các API không cần đăng nhập là dùng được.
4. Đổi xong, máy chủ cấp token mới không có claim đó và phiên làm việc bắt đầu bình thường.

`password_changed_at` trống được coi là **không bao giờ hết hạn**. Script `59-login-security.sql` điền ngày chạy script cho mọi tài khoản đang có, nên không ai bị bắt đổi ngay sau khi nâng cấp.

## 4. Chặn tạm khi đăng nhập sai

Mỗi lần đăng nhập ghi một dòng vào `sys_login_history`. Trước khi kiểm mật khẩu, máy chủ đếm các lần **thất bại** của tên đăng nhập đó: kết quả `WRONG_PASSWORD` (sai mật khẩu) hoặc `UNKNOWN_USER` (tên không tồn tại), sau lần đăng nhập thành công gần nhất và trong khoảng thời gian của chính sách.

- Đủ số lần sai trong khoảng thời gian thì từ chối với `auth.tooManyFailures` ("Đăng nhập sai quá nhiều lần. Hãy thử lại sau {n} phút."), tính từ lần sai cuối cùng, và **không kiểm mật khẩu**, nên trong lúc chờ có đoán đúng cũng không vào được. Lần bị chặn ghi kết quả `BLOCKED`.
- Tên không tồn tại cũng bị đếm, nên kẻ dò không phân biệt được tên nào có thật qua thông báo chặn. Thông báo sai mật khẩu và sai tên là cùng một câu (`auth.wrongCredentials`), và thời gian trả lời gần như nhau (máy chủ vẫn băm mật khẩu với một tài khoản giả).
- Đăng nhập thành công thì bộ đếm về 0.
- Ngoài ra API đăng nhập giới hạn **10 lần mỗi phút cho mỗi địa chỉ IP** (rate limiting của ASP.NET Core).

## 5. Tự đăng xuất khi không thao tác

Có hai lớp, cùng dùng số phút "Tự đăng xuất khi không thao tác" của chính sách (0 = tắt cả hai).

**Ở trình duyệt** (`components/layout/IdleSignOut.tsx`, gắn trong `App.tsx` khi đã đăng nhập):

- Thao tác là bấm chuột, gõ phím, cuộn, chạm hoặc di chuột. Thời điểm thao tác cuối lưu ở `localStorage['serp_last_activity']`, **dùng chung mọi tab**: làm việc ở một tab thì các tab khác không bị đăng xuất.
- Trong lúc người dùng làm việc, trình duyệt gửi `POST /api/auth/activity` (nhịp tim), **nhiều nhất mỗi phút một lần**.
- 60 giây trước giới hạn, hộp **Sắp đăng xuất** đếm ngược; bấm "Tiếp tục làm việc" hoặc thao tác bất kỳ là tính lại từ đầu.
- Hết giờ: đăng xuất và báo "Đã tự đăng xuất vì bạn không thao tác quá lâu."

**Ở máy chủ** (`SessionActivity`, kiểm trong `OnTokenValidated` của JWT ở `ApiServiceExtensions.cs`):

- Mỗi token là một phiên (claim session id). Máy chủ nhớ trong bộ nhớ lần hoạt động cuối của từng phiên: lúc đăng nhập, đổi đơn vị, đổi mật khẩu, và mỗi nhịp tim. Các lời gọi nền của màn hình (thông báo, thanh thông báo) **không** tính là hoạt động.
- Phiên im lặng quá giới hạn **cộng thêm 2 phút** thì mọi lời gọi bị 401 "Phiên đăng nhập đã hết hạn do không thao tác.", ghi một dòng `IDLE_TIMEOUT` vào lịch sử, và trình duyệt đăng xuất. 2 phút dư là vì nhịp tim chỉ gửi mỗi phút một lần: nhịp cuối có thể sớm hơn thao tác cuối gần một phút, và không được để máy chủ từ chối trước khi trình duyệt hết giờ.
- Nhờ lớp này, một token bị lấy cắp rồi bỏ đó cũng hết dùng được sau thời gian không thao tác.
- Bộ nhớ phiên mất khi khởi động lại backend: các phiên đang mở bắt đầu đếm lại từ lần gọi tiếp theo. Chỉ chạy đúng với **một** máy chủ backend (giống luồng thông báo realtime).

## 6. Lịch sử đăng nhập

`sys_login_history` ghi mọi lần đăng nhập, đăng xuất và hết phiên:

| Kết quả | Khi nào |
|---|---|
| `SUCCESS` | Đăng nhập thành công |
| `WRONG_PASSWORD` | Sai mật khẩu |
| `UNKNOWN_USER` | Tên đăng nhập không tồn tại (hoặc tài khoản đã khóa / xóa) |
| `UNIT_DENIED` | Đúng mật khẩu nhưng không được vào đơn vị đã chọn |
| `BLOCKED` | Bị chặn tạm vì sai nhiều lần |
| `LOGOUT` | Bấm Đăng xuất (`POST /api/auth/logout`) |
| `IDLE_TIMEOUT` | Máy chủ từ chối phiên vì không thao tác |

Mỗi dòng có thời điểm (UTC), tên đăng nhập đã gõ, mã người dùng (nếu có), đơn vị, địa chỉ IP và trình duyệt (`User-Agent`). Dòng cũ được xóa cùng lúc và cùng thời hạn với nhật ký thay đổi (Cài đặt › Nhật ký thay đổi › Lưu trữ; 0 = giữ mãi), bởi `AuditLogCleanupService`.

Xem lịch sử: `GET /api/settings/security/login-history` (quyền Xem của `sys_users`). Quản trị viên thấy mọi dòng; người khác chỉ thấy các tài khoản **cùng đơn vị cơ sở** với mình và không thấy các tên không tồn tại.

## 7. Đổi chính sách

Hiện **chưa có màn hình** cho chính sách và lịch sử đăng nhập (xem mục 11): backend và hàm gọi API ở frontend (`services/securityApi.ts`: `getPolicy`, `savePolicy`, `loginHistory`) đã có. Trong lúc chờ, quản trị viên đổi bằng Swagger (`http://localhost:2512/swagger` ở môi trường Development):

1. `POST /api/auth/login` bằng tài khoản quản trị, bấm **Authorize** và dán token.
2. `GET /api/settings/security/policy` để lấy chính sách hiện tại.
3. Sửa giá trị rồi gửi `PUT /api/settings/security/policy` với cả đối tượng, ví dụ:

```json
{
  "passwordMinLength": 10, "passwordRequireLetter": true, "passwordRequireDigit": true,
  "passwordRequireUpper": true, "passwordRequireSpecial": false,
  "passwordExpiryDays": 180, "passwordHistory": 5, "mustChangeAfterReset": true,
  "loginMaxFailures": 5, "loginFailureWindowMinutes": 15, "loginBlockMinutes": 30,
  "idleTimeoutMinutes": 60
}
```

Giới hạn giá trị (sai thì báo `security.invalid`):

| Trường | Từ | Đến |
|---|---|---|
| `passwordMinLength` | 6 | 64 |
| `passwordExpiryDays` | 0 | 3650 |
| `passwordHistory` | 0 | 24 |
| `loginMaxFailures` | 0 | 100 |
| `loginFailureWindowMinutes`, `loginBlockMinutes` | 1 | 1440 |
| `idleTimeoutMinutes` | 0 | 1440 |

Chính sách mới có hiệu lực ngay (bộ nhớ đệm bị xóa khi `sys_setting` được ghi). Quy tắc mật khẩu mới chỉ áp dụng cho lần đặt mật khẩu sau đó; số ngày hết hạn mới áp dụng ngay cho lần đăng nhập kế tiếp của mọi người.

## 8. Bảng dữ liệu

Script `ServerService/sql/postgresql/59-login-security.sql` (chạy lại được):

| Bảng / cột | Nội dung |
|---|---|
| `sys_users.password_changed_at` | Thời điểm đặt mật khẩu gần nhất (UTC); trống = không hết hạn |
| `sys_users.must_change_password` | Phải đổi mật khẩu ở lần đăng nhập tới |
| `sys_login_history` | `id`, `log_time`, `user_name`, `user_id`, `unit_code`, `ip_address`, `user_agent`, `result`; chỉ mục theo (`user_name`, `log_time`), (`user_id`, `log_time`), `log_time` |
| `sys_password_history` | `id`, `user_id`, `password_hash`, `created_at`: mật khẩu cũ dạng băm, tối đa 24 dòng mỗi tài khoản |
| `sys_setting` khóa `SECURITY_POLICY` | Chính sách dạng JSON (phạm vi toàn hệ thống) |

`sys_login_history` và `sys_password_history` không ghi vào nhật ký thay đổi (bản thân là nhật ký / dữ liệu bí mật). Thay đổi `must_change_password` của tài khoản có ghi nhật ký (trường `mustChangePassword`); `password_changed_at` thì không.

## 9. API

| API | Quyền | Việc |
|---|---|---|
| `POST /api/auth/login` | Công khai, 10 lần / phút / IP | Đăng nhập; kết quả có `mustChangePassword`, `passwordExpired` |
| `GET /api/auth/password-rules` | Đã đăng nhập (kể cả khi đang phải đổi mật khẩu) | Quy tắc mật khẩu và số phút tự đăng xuất, cho màn đổi mật khẩu và `IdleSignOut` |
| `POST /api/auth/activity` | Đã đăng nhập | Nhịp tim: tính lại thời gian không thao tác của phiên (204) |
| `POST /api/auth/logout` | Đã đăng nhập | Ghi `LOGOUT`, bỏ phiên khỏi bộ nhớ |
| `PUT /api/auth/me/password` | Đã đăng nhập | Tự đổi mật khẩu (theo chính sách), trả token mới |
| `GET /api/settings/security/policy` | Xem `sys_users` | Đọc chính sách |
| `PUT /api/settings/security/policy` | Sửa `sys_users` **và** là quản trị viên | Lưu chính sách |
| `GET /api/settings/security/login-history` | Xem `sys_users` | Lịch sử đăng nhập, phân trang; lọc `search` (tên, IP), `result`, `from`, `to` (ngày, theo giờ địa phương) |

## 10. Kiểm tra

1. Gõ sai mật khẩu của một tài khoản có thật 5 lần → lần 6 báo "Đăng nhập sai quá nhiều lần...", kể cả khi gõ đúng mật khẩu. Làm lại với một tên **không tồn tại** → lần 6 cũng báo câu đó.
2. Quản trị viên đặt lại mật khẩu cho một người → người đó đăng nhập thì chỉ thấy màn Cần đổi mật khẩu; gọi một API khác bằng token đó → 403. Đổi xong thì vào làm việc bình thường.
3. Đổi mật khẩu về một trong các mật khẩu gần nhất → bị từ chối.
4. Đặt `idleTimeoutMinutes` = 2 bằng Swagger, đăng nhập rồi để yên: sau 1 phút hiện hộp đếm ngược, sau 2 phút tự đăng xuất. Trong lúc làm việc, tab Network có `POST /api/auth/activity` (nhiều nhất mỗi phút một lần). Đặt lại giá trị cũ khi xong.
5. Xem `GET /api/settings/security/login-history` có đủ các dòng của các bước trên. Xóa các dòng thử: `delete from sys_login_history where user_name = '<tên thử>'`.

## 11. Giới hạn hiện tại

- **Chưa có màn hình** Cài đặt cho chính sách bảo mật và lịch sử đăng nhập (chỉ có API, mục 7).
- Bấm Đăng xuất chỉ bỏ phiên khỏi bộ nhớ của máy chủ, **không thu hồi token**: nếu token đã bị sao chép, nó vẫn dùng được (và bắt đầu đếm thời gian không thao tác lại từ đầu) cho tới khi hết hạn JWT. Khóa tài khoản hoặc đổi mật khẩu thì mọi token cũ mất hiệu lực ngay (`security_version`).
- Bộ nhớ phiên nằm trong một tiến trình backend: chạy nhiều máy chủ sau bộ cân bằng tải thì cần chuyển sang bộ nhớ dùng chung.
- Môi trường Development: tài khoản `admin` được đặt lại mật khẩu theo `Seed:AdminPassword` mỗi lần backend khởi động và không bao giờ bị bắt đổi hay hết hạn mật khẩu (để luôn có một tài khoản đăng nhập được). Tài khoản mẫu và tài khoản quản trị đầu tiên của môi trường mới tính hạn mật khẩu từ lúc được tạo.

## 12. Tệp mã nguồn

| Phần | Tệp |
|---|---|
| Chính sách, quy tắc | `ServerService/Core.Application/Common/Security/SecurityPolicy.cs` |
| Đọc / lưu chính sách, lịch sử mật khẩu, lịch sử đăng nhập, bộ nhớ phiên | `ServerService/Core.Infrastructure/Modules/Auth/LoginSecurityServices.cs` |
| Đăng nhập, chặn tạm, cấp token | `ServerService/Core.Infrastructure/Modules/Auth/AuthService.cs` |
| Kiểm phiên không thao tác | `ServerService/Core/Common/Extensions/ApiServiceExtensions.cs` (`OnTokenValidated`) |
| Chặn API khi phải đổi mật khẩu | `ServerService/Core/Common/Authorization/PasswordChangeFilter.cs` |
| API | `ServerService/Core/Modules/Auth/AuthController.cs`, `ServerService/Core/Modules/Users/SecurityController.cs` |
| Thực thể | `ServerService/Core.Domain/Modules/Users/LoginSecurity.cs` |
| Frontend | `components/layout/IdleSignOut.tsx`, `modules/account/ForcedPasswordChange.tsx`, `modules/account/PasswordRulesHint.tsx`, `services/securityApi.ts`, `services/authService.ts` (`mustChangePassword`) |
