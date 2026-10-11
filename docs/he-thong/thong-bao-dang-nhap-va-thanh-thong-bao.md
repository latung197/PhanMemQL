# Thông báo trang đăng nhập và thanh thông báo hệ thống

Tài liệu mô tả hai chức năng cho phép quản trị viên đưa thông tin đến người dùng mà không cần sửa mã nguồn, và phần hồ sơ doanh nghiệp đi kèm màn đăng nhập. Gồm cách dùng (mục 2 đến 4), cách hệ thống hoạt động (mục 5), các bảng và API (mục 6, 7), cách kiểm tra (mục 8) và những điều cần lưu ý (mục 9).

## 1. Tổng quan

| Chức năng | Ai thấy | Hiện ở đâu | Quản lý ở đâu | Mã chức năng |
|---|---|---|---|---|
| Thông báo trang đăng nhập | Bất kỳ ai mở trang đăng nhập, **chưa cần đăng nhập** | Khung xanh bên trái màn đăng nhập | Cài đặt › Khai Báo Mặc Định › Thông báo trang đăng nhập | `sys_login_notices` |
| Hồ sơ doanh nghiệp (tên, khẩu hiệu, chân trang) | Như trên | Khẩu hiệu trong thẻ đăng nhập, chân trang của khung bên trái | Cài đặt › Hồ sơ doanh nghiệp & sao lưu › mục "Hiển thị ở trang đăng nhập" | `settings_main` |
| Thanh thông báo hệ thống | Người dùng **đã đăng nhập** | Thanh mỏng ngay dưới header, mọi màn hình | Cài đặt › Khai Báo Mặc Định › Thanh thông báo hệ thống | `sys_banners` |

Hai chức năng khác chuông thông báo (nút quả chuông ở header). Chuông là thông báo **gửi riêng cho từng người** và lưu trong hộp thư của họ; thanh thông báo và thông báo đăng nhập là **phát chung**, ai thuộc đối tượng cũng thấy, không có trạng thái đã đọc.

Thông báo trang đăng nhập đọc được khi chưa đăng nhập, vì vậy **không ghi dữ liệu nội bộ** (số liệu, tên khách hàng, đường dẫn máy chủ) vào đó. Cũng áp dụng cho ảnh tải lên.

## 2. Thông báo trang đăng nhập

### 2.1. Một thông báo gồm những gì

| Trường | Ý nghĩa |
|---|---|
| Mã thông báo | Tối đa 30 ký tự, chữ hoa không dấu cách (ví dụ `TET-2027`). Không đổi được sau khi tạo |
| Loại | Chào mừng, Thông tin, Quy tắc, Bảo trì hoặc Ảnh nền (xem 2.2) |
| Tiêu đề, Nội dung | Chữ tiếng Việt hiển thị trên thẻ. Nội dung xuống dòng được |
| Bản tiếng Anh | Tiêu đề và nội dung tiếng Anh. Không bắt buộc; để trống thì người dùng chọn tiếng Anh vẫn thấy bản tiếng Việt |
| Ảnh | Một ảnh gắn với thông báo (xem 2.4) |
| Hiển thị từ ngày, Đến hết ngày | Cả hai tính trọn ngày. Để trống ngày bắt đầu là hiện ngay; để trống ngày kết thúc là hiện đến khi tắt |
| Thứ tự | Số nhỏ đứng trước |
| Ghim | Bài ghim luôn giữ khung lớn (xem 2.3) |
| Đang sử dụng | Bỏ chọn để tắt tạm mà không xóa |

Form chia 3 tab: **Nội dung** (mã, loại, tiêu đề, nội dung, ảnh), **Bản tiếng Anh**, **Hiển thị** (ngày, thứ tự, ghim, trạng thái). Loại "Ảnh nền" chỉ cần tiêu đề (để nhận biết), ảnh và ngày hiệu lực nên form ẩn ô nội dung, tab tiếng Anh và ô ghim.

### 2.2. Các loại thông báo

| Loại | Dùng cho | Hiển thị |
|---|---|---|
| Chào mừng | Lời chào theo dịp: Tết, ngày thành lập công ty | Nhãn "Chào mừng" |
| Thông tin | Tin chung | Nhãn "Thông tin" |
| Quy tắc | Nhắc quy định: đổi mật khẩu, không chia sẻ tài khoản | Nhãn "Quy tắc" |
| Bảo trì | Lịch ngưng hệ thống | Nhãn vàng nổi bật |
| Ảnh nền | Chỉ có ảnh | Làm nền cả khung bên trái, không hiện chữ. Có thể tạo nhiều ảnh nền theo từng dịp bằng cách hẹn ngày; nếu nhiều ảnh nền cùng hiệu lực thì dùng ảnh đứng trước theo thứ tự |

### 2.3. Cách hiển thị: hai khung

Mỗi lần màn đăng nhập chỉ hiện **tối đa 2 bài**:

- **Khung lớn:** bài ghim, hoặc bài đứng đầu nếu không có bài ghim nào. Thứ tự do server quyết định: ghim trước, rồi theo cột "Thứ tự", rồi theo mã.
- **Khung nhỏ:** các bài còn lại lần lượt hiện, **8 giây đổi một bài**, có chấm báo vị trí. Rê chuột vào thì tạm dừng.
- Server chỉ trả về tối đa 10 thông báo đang hiệu lực.
- Nội dung dài thì vùng thông báo có **thanh cuộn riêng ở mép trái**; form đăng nhập bên phải đứng yên, cả trang không cuộn trên màn rộng.
- Màn hẹp (điện thoại): khung bên trái ẩn đi, hai bài hiện phía trên form, cao tối đa 45% màn hình và cuộn riêng.
- Khi không có thông báo nào, khung bên trái chỉ còn logo, nền xanh (hoặc ảnh nền nếu có) và chữ bản quyền.

### 2.4. Ảnh

- Chọn ảnh trong tab Nội dung. Trình duyệt **tự thu nhỏ** (cạnh dài tối đa 1600 px, dưới khoảng 1,5 MB, ưu tiên định dạng WebP, nếu trình duyệt không hỗ trợ thì JPEG) rồi mới tải lên. Ảnh nhỏ sẵn (dưới 400 KB và cạnh dài không quá 1600 px) thì tải lên nguyên bản.
- Định dạng nhận: JPG, PNG, WebP. Mỗi ảnh tối đa 2 MB.
- Thông báo có ảnh thì ảnh là nền của thẻ, phủ lớp tối 65% và chữ có bóng nhẹ để dễ đọc.
- Đổi ảnh, gỡ ảnh hoặc xóa thông báo thì ảnh cũ **tự bị xóa** nếu không còn thông báo nào dùng.
- Danh sách thông báo hiện ảnh thu nhỏ đầu mỗi dòng và biểu tượng ghim cuối dòng.

### 2.5. Nhập và xuất Excel

Có đủ nút Nhập Excel, Xuất Excel, xóa nhiều như các danh mục khác. File có cột **Ghim** và **Mã ảnh**. Giữ nguyên cột Mã ảnh khi nhập lại file để không làm mất ảnh. Ảnh không đi theo file Excel: chỉ mang theo mã, nên đưa dữ liệu sang hệ thống khác thì phải tải lại ảnh.

## 3. Tên công ty, khẩu hiệu, chân trang

Lấy từ **hồ sơ doanh nghiệp** (Cài đặt › Hồ sơ doanh nghiệp & sao lưu, mục "Hiển thị ở trang đăng nhập"):

| Ô trong hồ sơ | Hiển thị ở đâu | Nếu để trống |
|---|---|---|
| Khẩu hiệu (`slogan`) | Dưới logo trong thẻ đăng nhập | Dùng câu có sẵn "Hệ thống Quản trị Sản Xuất & Doanh Nghiệp" |
| Dòng chân trang (`loginFooter`) | Chân khung xanh bên trái | Dùng câu bản quyền có sẵn |

Ghi chú:

- Màn đăng nhập đọc qua `GET /api/auth/branding`, công khai, **chỉ trả ba chữ** (tên, khẩu hiệu, chân trang). Mã số thuế, địa chỉ, người đại diện và các trường khác của hồ sơ không bao giờ được trả ra ngoài.
- Tên hiển thị lấy từ ô "Tên viết tắt", nếu trống thì lấy "Tên doanh nghiệp". Hiện tại màn đăng nhập không còn hiện dòng tên lớn (logo FSTV đã là tên công ty), nhưng API vẫn trả tên để dùng lại sau.
- **Logo FSTV** (`components/common/BrandLogo.tsx`) là hình SVG vẽ sẵn trong mã nguồn: ô bo góc chứa chữ F dựng bằng ba thanh và chữ FSTV. Muốn đổi sang logo chính thức thì thay nội dung file này (hoặc cho đọc `logoUrl` trong hồ sơ doanh nghiệp khi cần).

## 4. Thanh thông báo hệ thống

### 4.1. Một thông báo gồm những gì

| Trường | Ý nghĩa |
|---|---|
| Mã thông báo | Tối đa 30 ký tự, không đổi được sau khi tạo |
| Mức | **Thông tin** (xanh nhạt), **Cảnh báo** (vàng), **Khẩn** (đỏ, người dùng không đóng được) |
| Nội dung | Tối đa 500 ký tự |
| Nội dung tiếng Anh | Không bắt buộc; người dùng chọn tiếng Anh thấy bản này |
| Bắt đầu / Kết thúc hiển thị | Ngày và giờ. Để trống bắt đầu là hiện ngay; để trống kết thúc là hiện đến khi tắt |
| Đơn vị cơ sở | Để trống: mọi đơn vị thấy. Chọn một hay nhiều đơn vị: chỉ người **đang làm việc ở đơn vị đó** thấy |
| Thứ tự | Số nhỏ đứng trước (mức khẩn luôn đứng đầu, rồi cảnh báo, rồi thông tin) |
| Đang sử dụng | Tắt tạm |

Form có **dải Xem trước** luôn nằm trên cùng, đổi theo chữ và mức vừa nhập đúng như người dùng sẽ thấy, rồi chia 2 tab:

- **Nội dung:** chọn mức bằng ba thẻ (Thông tin, Cảnh báo, Khẩn, mỗi thẻ có mô tả ngắn về cách người dùng đóng được hay không), mã thông báo, nội dung và nội dung tiếng Anh.
- **Hiển thị:** giờ bắt đầu và kết thúc, các nút **kết thúc nhanh** (Hết hôm nay, 2 giờ nữa, 1 ngày, 7 ngày, Không hết hạn), đơn vị cơ sở, thứ tự và trạng thái.

Giờ nhập theo múi giờ của máy người nhập; hệ thống lưu giờ UTC. Trong danh sách, cột Trạng thái tính sẵn: **Đang tắt**, **Chờ hiển thị**, **Đang hiển thị**, **Đã hết hạn**.

### 4.2. Người dùng thấy gì

- Thanh nằm ngay dưới header, mỗi thông báo một dòng, tối đa **5 dòng** cùng lúc.
- Có giờ kết thúc thì cuối dòng hiện "Đến 22:00 14/10/2026" (ẩn trên màn nhỏ).
- **Đóng (nút X), tùy mức:**
  - **Thông tin:** ẩn hẳn **theo tài khoản** (lưu trong trình duyệt, khóa `s_erp_banner_dismissed:{tên đăng nhập}`), nên người khác đăng nhập cùng máy vẫn thấy. Thông báo hiện lại khi được **sửa** (mỗi lần sửa, mã phiên bản đổi). Đổi trình duyệt hoặc xóa dữ liệu trình duyệt thì hiện lại.
  - **Cảnh báo:** chỉ ẩn **trong phiên đăng nhập hiện tại** (`sessionStorage`, khóa `s_erp_banner_hidden:{tên đăng nhập}`). Tải lại trang vẫn ẩn; **đăng xuất rồi đăng nhập lại, hoặc đóng tab, thì hiện lại**, để cảnh báo không bị bỏ sót.
  - **Khẩn:** không có nút đóng.
  - Khi có thông báo đã đóng, dưới thanh hiện dòng nhỏ "Có n thông báo đã đóng · Xem lại"; bấm vào thì hiện lại tất cả.
- **Chữ dài:** nếu nội dung dài hơn thanh thì chạy chậm từ phải sang trái (tốc độ khoảng 7 ký tự mỗi giây), rê chuột vào thì dừng. Người dùng đặt hệ điều hành "giảm chuyển động" thì chữ đứng yên và bị cắt bằng "…" (rê chuột để xem đầy đủ).
- **Cập nhật tức thì:** quản trị viên lưu hay xóa thông báo thì các máy đang mở thấy thay đổi trong vài giây, không cần tải lại. Ngoài ra thanh tự đọc lại **mỗi phút** (khi tab đang hiện), nên thông báo hẹn giờ bắt đầu hay hết hạn cũng tự bật tắt đúng giờ.
- Đổi đơn vị làm việc thì thanh đổi theo đơn vị mới. Đổi ngôn ngữ thì nội dung theo ngôn ngữ mới.

## 5. Cách hệ thống hoạt động

### 5.1. Luồng ảnh

1. Người dùng chọn ảnh, trình duyệt thu nhỏ rồi gửi `POST /api/settings/login-notice-images` với JSON `{ contentType, dataBase64 }`.
2. Server kiểm tra loại (chỉ `image/jpeg`, `image/png`, `image/webp`), cỡ (tối đa 2 MB) và **kiểm tra cả vài byte đầu của file** (JPEG phải bắt đầu `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF....WEBP`). Một file chữ hay mã script đổi đuôi thành `.png` sẽ bị từ chối.
3. Ảnh lưu vào bảng `sys_login_image` với mã mới `IMG-` kèm 16 ký tự ngẫu nhiên, server trả mã này.
4. Form gắn mã vào thông báo (`login_image_code`). Khi lưu, server kiểm tra mã ảnh có tồn tại.
5. Màn đăng nhập hiển thị ảnh qua `GET /api/auth/notice-images/{mã}` (công khai). Vì mã đổi sau mỗi lần tải lên nên server cho trình duyệt **lưu đệm 1 năm** (`Cache-Control: public, max-age=31536000, immutable`).

Lưu ý khi thử: vì ảnh được lưu đệm 1 năm theo mã, một ảnh đã xóa trong cơ sở dữ liệu vẫn có thể hiện ra ở trình duyệt từng xem nó cho đến khi tải lại cứng (Ctrl+F5).

### 5.2. Luồng thanh thông báo

1. `SystemBanner` (đặt dưới `Header` trong `App.tsx`) gọi `GET /api/banners/active` khi vào, khi đổi đơn vị, mỗi phút và khi nhận tín hiệu.
2. Server lấy các thông báo đang bật, trong khoảng giờ, đúng đơn vị của token, sắp xếp mức khẩn trước, cắt còn 5 và chọn chữ theo `Accept-Language`.
3. Mỗi lần lưu, sửa, xóa hoặc nhập Excel, `BannerService` gọi `PublishSettings()`: tín hiệu `settings` đi qua kênh SSE (`/api/notifications/stream`) tới mọi tab đang mở. Frontend nhận tín hiệu thì ngoài việc nạp lại cài đặt còn phát sự kiện `erp:banners-changed` để thanh đọc lại.
4. Thanh không dùng bộ nhớ đệm phía server: truy vấn nhỏ và luôn phải đúng giờ.

### 5.3. Thứ tự và đa ngôn ngữ

- Thông báo đăng nhập: chọn bản tiếng Anh khi ngôn ngữ trình duyệt (tiêu đề `Accept-Language`) bắt đầu bằng `en` và thông báo có tiêu đề tiếng Anh; còn lại dùng tiếng Việt. Trang đăng nhập đọc lại thông báo mỗi khi người dùng đổi ngôn ngữ trên trang.
- Thanh thông báo: dùng ngôn ngữ của người dùng; thiếu bản tiếng Anh thì dùng bản tiếng Việt.

## 6. Cơ sở dữ liệu

Chạy theo thứ tự `36-login-notices.sql`, `37-login-notice-images.sql`, `38-banners.sql` (đều chạy lại được nhiều lần).

### 6.1. `sys_login_notice`

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `code` | varchar(30), khóa chính | Mã thông báo |
| `title` | varchar(200) | Tiêu đề |
| `content` | varchar(2000) | Nội dung |
| `title_en`, `content_en` | varchar(200), varchar(2000), cho phép trống | Bản tiếng Anh |
| `kind` | varchar(12) | `INFO`, `WELCOME`, `MAINTENANCE`, `RULE`, `BACKGROUND` (ràng buộc `ck_sys_login_notice_kind`) |
| `start_date`, `end_date` | date, cho phép trống | Khoảng ngày hiển thị, tính trọn ngày; `end_date` không trước `start_date` |
| `pinned` | boolean | Ghim |
| `login_image_code` | varchar(40), cho phép trống | Mã ảnh trong `sys_login_image` (có chỉ mục, khai báo `[References<LoginImage>]`) |
| `is_active`, `sort_order` | boolean, integer | Bật tắt và thứ tự |
| `created_at`, `created_by`, `updated_at`, `updated_by` | | Dấu bản ghi (người và giờ tạo, sửa) |

Script 36 tạo bảng và hai thông báo mẫu khi bảng còn trống; script 37 thêm cột `pinned`, `login_image_code`, chỉ mục và nới ràng buộc `kind`.

### 6.2. `sys_login_image`

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `code` | varchar(40), khóa chính | Mã ảnh, dạng `IMG-` và 16 ký tự ngẫu nhiên |
| `content_type` | varchar(30) | `image/jpeg`, `image/png` hoặc `image/webp` |
| `size_bytes` | integer | Số byte |
| `data` | bytea | Nội dung ảnh |
| Dấu bản ghi | | Bốn cột như trên |

Bảng không có màn danh sách: ảnh chỉ đọc theo mã. Nhờ lưu trong database nên sao lưu database là có luôn ảnh.

### 6.3. `sys_banner`

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `code` | varchar(30), khóa chính | Mã thông báo |
| `message`, `message_en` | varchar(500) | Nội dung, bản tiếng Anh (cho phép trống) |
| `level` | varchar(8) | `INFO`, `WARNING`, `URGENT` |
| `start_at`, `end_at` | timestamptz, cho phép trống | Khoảng giờ hiển thị (UTC); `end_at` không trước `start_at` |
| `unit_codes` | varchar(500) | Mã đơn vị cách nhau bằng dấu phẩy, viết hoa; **trống là mọi đơn vị**. Không phải khóa tham chiếu: đơn vị bị xóa thì thông báo chỉ ngừng khớp |
| `is_active`, `sort_order` | boolean, integer | Bật tắt và thứ tự |
| Dấu bản ghi | | Bốn cột như trên |

Cả ba bảng không có khóa ngoại. Quan hệ duy nhất giữa chúng là `sys_login_notice.login_image_code`, được lưu vào `sys_table_ref` để kiểm tra mã khi lưu.

## 7. API

| Phương thức và đường dẫn | Ai gọi được | Nội dung |
|---|---|---|
| `GET /api/auth/notices` | Công khai | Thông báo đăng nhập đang hiệu lực (tối đa 10): `code`, `kind`, `title`, `content`, `pinned`, `imageCode`. Chữ theo `Accept-Language` |
| `GET /api/auth/branding` | Công khai | `name`, `slogan`, `footer` lấy từ hồ sơ doanh nghiệp |
| `GET /api/auth/notice-images/{code}` | Công khai | Nội dung ảnh, lưu đệm 1 năm |
| `GET`, `POST /api/settings/login-notices`, `PUT`, `DELETE /{code}`, `GET .../export`, `POST .../import`, `POST .../delete-many` | Quyền `sys_login_notices` | Bảy API của khung danh mục. Bộ lọc riêng: `kind=` (`INFO`, `WELCOME`, `RULE`, `MAINTENANCE`, `BACKGROUND`) |
| `POST /api/settings/login-notice-images` | Quyền **Thêm** của `sys_login_notices` | Tải ảnh lên (JSON `{ contentType, dataBase64 }`), trả `{ code }` |
| `GET /api/banners/active` | Mọi người dùng đã đăng nhập | Thanh thông báo hiệu lực của đơn vị đang làm việc: `code`, `level`, `message`, `endAt`, `version` |
| `GET`, `POST /api/settings/banners`, `PUT`, `DELETE /{code}`, `GET .../export`, `POST .../import`, `POST .../delete-many` | Quyền `sys_banners` | Bảy API của khung danh mục. Bộ lọc riêng: `level=` |

Quyền theo khung danh mục: Xem (danh sách), Xem + Xuất (xuất Excel), Thêm (tạo, nhập Excel), Sửa, Xóa. Người chỉ có quyền Sửa mà không có quyền Thêm thì chưa tải được ảnh mới. Quản trị viên (vai trò ADMIN) có sẵn mọi quyền; các vai trò khác cấp ở Cài đặt › Người dùng & phân quyền.

Thông báo lỗi (tiếng Việt hoặc tiếng Anh theo người dùng): mức hoặc loại sai, ngày hoặc giờ kết thúc trước bắt đầu, thông báo loại Ảnh nền thiếu ảnh, đơn vị không tồn tại (thanh thông báo), mã trùng, ảnh sai định dạng hoặc quá 2 MB, mã ảnh không tồn tại.

## 8. Cách kiểm tra nhanh

1. Đăng xuất, mở trang đăng nhập: thấy hai thông báo mẫu bên trái.
2. Vào Cài đặt › Thông báo trang đăng nhập, thêm một thông báo loại Bảo trì, chọn ảnh, tick Ghim, lưu. Đăng xuất: thông báo đó nằm ở khung lớn với ảnh làm nền.
3. Thêm thông báo loại Ảnh nền có ảnh: khung bên trái đổi nền.
4. Đặt "Đến hết ngày" là hôm qua: thông báo biến mất khỏi trang đăng nhập.
5. Vào Cài đặt › Thanh thông báo hệ thống, tạo thông báo mức Cảnh báo: thanh hiện dưới header của máy đang mở trong vài giây. Bấm X thì ẩn; sửa nội dung rồi lưu thì hiện lại. Đổi sang mức Khẩn thì mất nút X.
6. Chọn đơn vị cơ sở là DVCS02 rồi đổi đơn vị làm việc ở header: chỉ DVCS02 thấy thanh.

Kiểm thử tự động: `ReadAccessContractTests`, `TableReferenceTests`, `CatalogFrameworkTests`, `MessagesTests` và `MenuSeedFileTests` bao phủ khung danh mục, bản đồ tham chiếu, thông báo hai ngôn ngữ và menu của hai chức năng này.

## 9. Lưu ý và hạn chế

- **Dữ liệu công khai:** ba API `/api/auth/notices`, `/api/auth/branding`, `/api/auth/notice-images/{code}` không cần đăng nhập. Không đưa thông tin nội bộ vào thông báo, ảnh hay khẩu hiệu.
- **Tên cột:** quy ước chung của danh mục là khóa `code` và tên `name`. Hai bảng này dùng `title` (thông báo đăng nhập) và `message` (thanh thông báo) vì đây là nội dung hiển thị chứ không phải tên để chọn ở màn khác; khung dùng chung vẫn chạy bình thường (lấy `code` khi không có `name`). Nếu sau này cần chọn thông báo ở màn khác thì đổi `title` thành `name` cho khớp quy ước.
- **Ảnh nền với màn hình rất rộng:** ảnh được phóng theo khung nên nên chọn ảnh ngang, tối thiểu 1600 px.
- **Trạng thái đóng lưu trong trình duyệt:** không lưu ở server, nên quản trị viên không biết ai đã đóng, và cùng một tài khoản dùng máy khác sẽ thấy lại thông báo thông tin đã đóng.
- **Chưa có:** đường dẫn bấm vào thanh thông báo để mở một màn hình, đếm ngược cho thông báo bảo trì, gửi thanh thông báo theo vai trò hoặc từng người, quyền "Sửa" đủ để thay ảnh (hiện cần quyền Thêm).
- **Hồ sơ doanh nghiệp:** màn này chưa chuyển sang đa ngôn ngữ (chữ gõ cứng tiếng Việt như các ô cũ của màn), nên hai ô "Khẩu hiệu" và "Dòng chân trang" mới thêm cũng đang gõ cứng.
- **Khẩu hiệu và chân trang chỉ có một ngôn ngữ:** hiển thị cùng một chữ cho mọi ngôn ngữ nếu đã nhập; để trống thì dùng câu có sẵn theo ngôn ngữ của người xem.

## 10. Các tệp mã nguồn

| Lớp | Tệp |
|---|---|
| Cơ sở dữ liệu | `ServerService/sql/postgresql/36-login-notices.sql`, `37-login-notice-images.sql`, `38-banners.sql` |
| Thực thể | `Core.Domain/Modules/LoginNotices/LoginNotice.cs`, `LoginImage.cs`; `Core.Domain/Modules/Banners/Banner.cs` |
| Hợp đồng và dịch vụ | `Core.Application/Modules/LoginNotices/LoginNoticeContracts.cs`, `Core.Infrastructure/Modules/LoginNotices/LoginNoticeService.cs`; `Core.Application/Modules/Banners/BannerContracts.cs`, `Core.Infrastructure/Modules/Banners/BannerService.cs` |
| Hồ sơ doanh nghiệp | `ISystemConfigService.GetLoginBrandingAsync` trong `Core.Application/Modules/SystemConfig/SystemConfigContracts.cs`, cài đặt ở `Core.Infrastructure/Modules/SystemConfig/SystemConfigService.cs` |
| API | `Core/Modules/Auth/AuthController.cs` (các API công khai), `Core/Modules/LoginNotices/LoginNoticesController.cs`, `LoginNoticeImagesController.cs`, `Core/Modules/Banners/BannersController.cs` |
| Màn đăng nhập | `Frontend/src/modules/auth/LoginView.tsx`, `Frontend/src/components/common/BrandLogo.tsx`, `Frontend/src/utils/imageCompress.ts` |
| Quản lý thông báo đăng nhập | `Frontend/src/modules/settings/LoginNoticeCategoryView.tsx`, `LoginNoticeForm.tsx` |
| Thanh thông báo | `Frontend/src/components/layout/SystemBanner.tsx` (thanh và bản xem trước), `Frontend/src/modules/settings/BannerCategoryView.tsx`, `BannerForm.tsx`; nối vào `App.tsx` |
| Dịch vụ gọi API | `Frontend/src/services/settingsApi.ts`, `authService.ts` |
| Menu và chức năng | `ServerService/Core/SeedData/menu.json`, `FunctionCatalog.cs`, `Frontend/src/config/functions.ts`, `Frontend/src/types/index.ts` |

Quy trình thêm một danh mục theo khung nằm ở `docs/phat-trien/them-danh-muc.md`; hai chức năng này làm theo đúng quy trình đó.
