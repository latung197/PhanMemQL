# Quản lý menu S-ERP

Tài liệu này mô tả menu bên trái của S-ERP: dữ liệu nằm ở đâu, ai được sửa gì, cách thêm chức năng mới vào menu và cách super admin chỉnh cấu trúc menu trên màn hình **Cài đặt › Quản lý menu**. Cách thêm một danh mục đầy đủ nằm ở `docs/them-danh-muc.md`; tài liệu này chỉ nói về menu và quyền liên quan.

---

## 1. Tổng quan

Menu có **ba cấp**: phân hệ → nhóm → chức năng.

| Cấp | Ví dụ | Do ai quyết định |
| --- | --- | --- |
| Phân hệ (module) | Phân Hệ Kho Hàng | Mã nguồn (mỗi phân hệ có một màn `*Module.tsx`); super admin chỉ đổi tên, icon, thứ tự, bật/tắt |
| Nhóm (group) | 3. Danh Mục Kho | Super admin tạo thêm được; nhóm có sẵn đến từ `menu.json` |
| Chức năng (function) | Danh mục Đơn vị tính (`inv_uom_cat`) | **Mã nguồn** (mã chức năng, màn hình, quyền); super admin chỉ đổi tên, icon, thứ tự, nhóm chứa, bật/tắt |

Nguyên tắc chia việc:

- **Lập trình viên** quyết định *có những chức năng nào* và khai báo chúng trong mã nguồn.
- **Super admin** quyết định *chúng hiện ra thế nào* trong menu (tên, icon, thứ tự, nhóm).
- **Quản trị viên có quyền Sửa màn Quản lý menu** chỉ ẩn/hiện mục cho mọi người dùng.
- **Quyền Xem** của từng người quyết định họ thấy mục nào (xem mục 4).

---

## 2. Dữ liệu menu nằm ở đâu

### 2.1. Bảng `sys_command`

Mỗi nút menu là một dòng của `sys_command`. Các cột menu:

| Cột | Ý nghĩa |
| --- | --- |
| `menuid0` | Khóa của dòng. Với **chức năng** là mã chức năng (ví dụ `inv_uom_cat`), cũng là khóa phân quyền. Với nhóm và phân hệ là id như `GRP_INV_CAT`, `MOD_INVENTORY` |
| `menu_kind` | `module`, `group` hoặc `function`. Dòng có `menu_kind` rỗng không phải nút menu |
| `menu_key` | Mã dùng trong mã nguồn: khóa phân hệ (`inventory`), mã nhóm (`categories`) hoặc mã chức năng |
| `menu_parent_id` | Nút cha: chức năng → nhóm, nhóm → phân hệ, phân hệ để trống |
| `menu_icon`, `menu_icon_color` | Tên icon (thư viện lucide) và lớp màu của icon (chỉ nhóm dùng màu) |
| `menu_order_no` | Thứ tự trong nút cha, số nhỏ đứng trước |
| `menu_is_active` | Tắt hẳn nút (mọi người đều không thấy) |
| `menu_direct_function_code` | Chỉ phân hệ: chức năng mở thẳng khi bấm phân hệ (ví dụ `overview_main`) |
| `hide_yn` | Ẩn theo lựa chọn của quản trị (màn Ẩn / hiện), xem mục 6 |
| `text`, `text2` | Tên tiếng Việt và tiếng Anh (bản sao tiện cho truy vấn) |

### 2.2. Bảng `sys_command_translation`

Tên hiển thị theo từng ngôn ngữ: `menuid0`, `language_code`, `title`. Thêm một ngôn ngữ mới chỉ thêm dòng, không đổi cấu trúc bảng. Ngôn ngữ phải có trong danh mục `sys_language`.

### 2.3. Tệp `ServerService/Core/SeedData/menu.json`

Tệp khai báo cây menu ban đầu. Mỗi lần backend khởi động, bộ nạp (`DatabaseSeeder.EnsureMenuTreeAsync`) đọc tệp này và **chỉ thêm** những nút mà database chưa có dòng menu:

- Nút đã có dòng menu thì **không bị đụng**, nên mọi chỉnh sửa trong database hoặc trên màn Quản lý menu được giữ nguyên qua các lần khởi động lại.
- Nút bị xóa khỏi `menu.json` thì **không** bị xóa khỏi database (muốn bỏ nút thì tắt nó, xem mục 5).
- Log ghi `Đã thêm N mục menu còn thiếu từ menu.json` khi có nút được thêm.

Ví dụ một chức năng trong `menu.json`:

```json
{
  "id": "MNU_INV_SUPPLIER",
  "subKey": "inv_supplier_cat",
  "titleVi": "Danh mục nhà cung cấp",
  "titleEn": "Suppliers",
  "icon": "Truck",
  "orderNo": 55,
  "isActive": true
}
```

---

## 3. Thêm một chức năng mới vào menu (lập trình viên)

Ba nơi phải khớp mã chức năng:

| # | Nơi | Việc |
| --- | --- | --- |
| 1 | `Core.Application/Common/Permissions/FunctionCatalog.cs` | Thêm mã và tên vào `Functions`. Khi khởi động API tự thêm mã vào `sys_command` và vào ma trận phân quyền |
| 2 | `ServerService/Core/SeedData/menu.json` | Thêm nút vào mảng `items` của nhóm. `subKey` phải đúng mã ở bước 1, `id` không trùng nút nào, `orderNo` không nên trùng nút cùng nhóm |
| 3 | `Frontend/src/types/index.ts` và `Frontend/src/config/functions.ts` | Thêm vào `SubMenuKey` và `FUNCTION_REGISTRY`; thêm `case` trong `*Module.tsx` của phân hệ |

Nếu dùng icon mới, thêm tên icon vào `components/common/DynamicIcon.tsx` (cả dòng `import` và bảng `iconMap`). Icon chưa đăng ký sẽ hiện icon mặc định.

Kiểm tra: `dotnet test` có `MenuSeedFileTests` báo đỏ khi mã chức năng không có trong `menu.json` (hoặc ngược lại) hoặc id nút bị trùng; `npm run lint` báo khi thiếu mục trong `FUNCTION_REGISTRY`.

Sau khi khởi động lại backend, nút mới xuất hiện trong database. Người dùng chỉ thấy nút khi được cấp quyền Xem (mục 4).

---

## 4. Ai thấy mục nào (phân quyền)

`GET /api/menu` chỉ trả về phần menu mà người gọi có quyền **Xem**:

- Chức năng không có quyền Xem thì bị bỏ.
- Nhóm hoặc phân hệ không còn chức năng nào thì bỏ theo.
- Trang tổng quan (`overview_main`) luôn có.
- Admin (vai trò ADMIN) thấy tất cả.

Việc lọc làm ở **server** (cắt từ cây đã đệm theo quyền của từng người), nên người dùng không thấy cả tên những chức năng họ không được dùng. Frontend lọc thêm theo "đang dùng" (`menu_is_active`) và "ẩn/hiện" (`hide_yn`).

Quyền thật vẫn nằm ở từng API (mỗi controller kiểm quyền Xem/Thêm/Sửa/...). Menu chỉ là cách điều hướng, nên ẩn menu **không** thu hồi quyền gọi API.

Ví dụ kết quả trên dữ liệu mẫu: admin thấy 78 nút (50 chức năng), kế toán trưởng 30 nút, thủ kho 17 nút, nhân viên kinh doanh 15 nút, chuyên viên nhân sự 10 nút.

---

## 5. Super admin sửa cấu trúc menu

### 5.1. Ai là super admin

Một tài khoản duy nhất, cấu hình trong `appsettings.Local.json`:

```json
{
  "Security": { "SuperAdmin": "admin" }
}
```

- Mặc định là `admin` (nếu không cấu hình).
- Tài khoản đó **phải đồng thời có vai trò ADMIN**. Một tài khoản trùng tên nhưng không phải ADMIN không có quyền gì.
- Các tài khoản ADMIN khác **không** sửa được cấu trúc. Chỉ super admin.
- Muốn chuyển quyền sang tài khoản khác, đổi giá trị `Security:SuperAdmin` rồi khởi động lại backend.
- Quyền này **không nằm trong ma trận phân quyền**, nên không ai tự cấp cho mình được qua màn phân quyền.

### 5.2. Mở màn hình

Đăng nhập bằng tài khoản super admin, vào **Cài đặt › Quản lý menu**. Màn hình có hai tab:

| Tab | Dùng để | Ai thấy |
| --- | --- | --- |
| **Ẩn / hiện** | Tích chọn phân hệ, chức năng hiện trong menu cho mọi người | Mọi người có quyền Xem màn này (Sửa thì cần quyền Sửa) |
| **Cấu trúc menu** | Sửa tên, icon, thứ tự, nhóm, thêm nhóm | Chỉ super admin |

### 5.3. Các việc làm được

Trên tab **Cấu trúc menu**, cây hiện đủ phân hệ → nhóm → chức năng, kể cả mục đã tắt (mờ, có nhãn *Đã tắt*).

| Việc | Cách làm |
| --- | --- |
| **Đổi tên** | Bấm nút bút chì ở mục, nhập tên từng ngôn ngữ (tiếng Việt bắt buộc, tối đa 100 ký tự; để trống một ngôn ngữ khác thì bỏ bản dịch đó) |
| **Đổi icon** | Trong hộp sửa, chọn tên icon (có hình xem trước). Chỉ các icon đã đăng ký trong `DynamicIcon.tsx` |
| **Đổi màu icon** | Chỉ nhóm: nhập lớp màu, ví dụ `text-emerald-400` (tùy chọn) |
| **Đổi thứ tự** | Bấm mũi tên lên/xuống: mục đổi chỗ với mục liền kề cùng nút cha; hệ thống đánh lại thứ tự 10, 20, 30... |
| **Chuyển chức năng sang nhóm khác** | Trong hộp sửa, chọn mục *Thuộc về* (hiện dạng "Phân hệ › Nhóm"). Nhóm chuyển sang phân hệ khác tương tự |
| **Tắt / bật một mục** | Bỏ/tích *Đang dùng* trong hộp sửa. Mục tắt không hiện cho ai |
| **Thêm nhóm mới** | Bấm *Thêm nhóm* ở phân hệ, nhập mã nhóm (chữ thường, số, gạch dưới, 2 đến 40 ký tự, bắt đầu bằng chữ, **không đổi được sau khi tạo**), tên, icon, thứ tự |

Sau khi lưu, menu của mọi người đang mở **tự tải lại** (máy chủ phát tín hiệu thời gian thực), không cần đăng nhập lại.

### 5.4. Việc không làm được ở đây

| Không làm được | Lý do và cách làm đúng |
| --- | --- |
| Thêm hoặc xóa **chức năng** | Chức năng gắn với mã nguồn, màn hình và quyền. Thêm: mục 3. Bỏ khỏi menu: tắt nút |
| Thêm **phân hệ** mới | Mỗi phân hệ cần khai báo trong mã (`CATEGORY_NAMES`, một `*Module.tsx`) |
| **Xóa nhóm** | Bộ nạp chỉ thêm, nên nhóm có trong `menu.json` sẽ quay lại. Hãy tắt nhóm (mục *Đang dùng*) |
| Tắt hoặc chuyển các mục bảo vệ | Xem mục 5.5 |

### 5.5. Các mục được bảo vệ

Để không ai khóa mình ra khỏi chính màn này, server từ chối tắt hoặc chuyển:

- chức năng `sys_menu` (Quản lý menu) và nhóm chứa nó;
- hai phân hệ `overview` (Tổng quan) và `settings` (Cài đặt).

Các mục này vẫn đổi tên, icon, thứ tự được.

### 5.6. Quy tắc kiểm tra của server

| Quy tắc | Thông báo khi vi phạm |
| --- | --- |
| Tên tiếng Việt không được trống | Hãy nhập tên tiếng Việt cho mục menu. |
| Ngôn ngữ phải có trong hệ thống | Ngôn ngữ "xx" chưa được khai báo trong hệ thống. |
| Tên tối đa 100 ký tự | Tên mục menu dài tối đa 100 ký tự. |
| Tên icon là chữ và số, bắt đầu bằng chữ | Tên biểu tượng không hợp lệ. |
| Màu icon chỉ gồm chữ, số, `-[]#/:.` | Màu biểu tượng không hợp lệ. |
| Thứ tự từ 0 đến 100000 | Thứ tự không hợp lệ. |
| Chức năng nằm trong nhóm, nhóm nằm trong phân hệ, phân hệ không có cha | Mục cha không hợp lệ: chức năng nằm trong nhóm, nhóm nằm trong phân hệ. |
| Mã nhóm đúng mẫu | Mã nhóm gồm chữ thường, số hoặc dấu gạch dưới... |
| Mã nhóm không trùng | Nhóm "x" đã tồn tại. |
| Mục được bảo vệ không tắt/chuyển | Mục này cần để vào được màn hình quản lý menu nên không được tắt hoặc chuyển chỗ. |

---

## 6. Ba cách "ẩn" một mục: khác nhau thế nào

| Cách | Ở đâu | Ai đặt | Tác dụng |
| --- | --- | --- | --- |
| **Không có quyền Xem** | Ma trận phân quyền | Quản trị phân quyền | Chỉ người đó không thấy; server không trả mục này |
| **Ẩn / hiện** (`hide_yn`) | Tab *Ẩn / hiện* | Quản trị có quyền Sửa màn Quản lý menu | Mọi người không thấy (chỉ ẩn điều hướng, API vẫn gọi được nếu có quyền). Toàn hệ thống, không theo đơn vị |
| **Đang dùng** (`menu_is_active`) | Tab *Cấu trúc menu* | Super admin | Tắt hẳn mục cho mọi người |

Chọn cách nào:

- Mục chưa sẵn sàng cho ai dùng: **Đang dùng** = tắt.
- Tạm ẩn một mục để gọn menu: **Ẩn / hiện**.
- Chỉ một số người được dùng: **phân quyền**.

---

## 7. API

| Phương thức và đường dẫn | Ai gọi được | Việc |
| --- | --- | --- |
| `GET /api/menu` | Mọi người đã đăng nhập | Cây menu đã lọc theo quyền Xem của người gọi |
| `GET /api/menu/access` | Mọi người đã đăng nhập | `{ "canEditStructure": true/false }`: có phải super admin không (frontend dùng để hiện tab) |
| `GET /api/menu/manage` | Super admin | Toàn bộ cây, không lọc, gồm cả mục đã tắt |
| `PUT /api/menu/nodes/{id}` | Super admin | Sửa một nút: `titles`, `icon`, `iconColor`, `orderNo`, `isActive`, `parentId` |
| `POST /api/menu/groups` | Super admin | Tạo nhóm: `moduleId`, `code`, `titles`, `icon`, `iconColor`, `orderNo` |
| `PUT /api/menu/order` | Super admin | Đặt lại thứ tự các con của một nút cha: `parentId`, `ids` (theo thứ tự mới) |

Người không phải super admin gọi các API ghi nhận **HTTP 403**. Lỗi quy tắc nhận **HTTP 400** kèm `{ "message": "..." }`.

Ví dụ sửa tên và icon của một chức năng:

```json
PUT /api/menu/nodes/inv_uom_cat
{
  "titles": { "vi": "Danh mục Đơn vị tính", "en": "Units of Measure" },
  "icon": "Scale",
  "iconColor": null,
  "orderNo": 50,
  "isActive": true,
  "parentId": "GRP_INV_CAT"
}
```

---

## 8. Nhật ký thay đổi

Mọi thay đổi cấu trúc menu được ghi vào nhật ký chung (`sys_audit_log`) và xem ở **Cài đặt › Nhật ký thay đổi**:

- chức năng `sys_menu`, loại đối tượng *Mục menu*;
- mỗi lần sửa ghi các trường đổi (`title.vi`, `title.en`, icon, màu, thứ tự, đang dùng, nhóm cha) với giá trị trước và sau;
- tạo nhóm ghi hành động *Tạo*; đổi thứ tự ghi một dòng cho cả cụm.

---

## 9. Bộ nhớ đệm và sửa trực tiếp database

Cây menu được đệm trong bộ nhớ của máy chủ (tối đa 10 phút) và **tự xóa đệm** khi `sys_command` hoặc `sys_command_translation` bị ghi qua ứng dụng.

Nếu sửa **trực tiếp bằng psql hoặc pgAdmin**, đệm không biết: menu có thể còn cũ đến 10 phút. Khởi động lại backend để làm sạch ngay. Với dữ liệu thật, hãy sửa qua màn Quản lý menu để có nhật ký và đệm đúng.

Đệm này chỉ đúng khi chạy **một** bản backend. Nếu sau này chạy nhiều bản, cần cơ chế xóa đệm dùng chung (Redis hoặc LISTEN/NOTIFY).

---

## 10. Các test bảo vệ

| Test | Bảo vệ điều gì |
| --- | --- |
| `MenuSeedFileTests` | `menu.json` khớp `FunctionCatalog` (không thiếu, không thừa, id không trùng) |
| `MenuFilterTests` | Lọc menu theo quyền Xem: không quyền chỉ còn trang tổng quan, giữ nhóm và phân hệ cha, bỏ nhóm rỗng |
| `MenuRulesTests` | Quy tắc sửa menu (cha đúng cấp, mục được bảo vệ, kiểm tra icon/màu/thứ tự/mã nhóm/ngôn ngữ) và việc xác định super admin |
| `MessagesTests` | Mọi thông báo lỗi của menu có đủ tiếng Việt và tiếng Anh |
| `npm run check-menu` (frontend) | Mọi nút của `menu.json` frontend biết (không bị bỏ lặng lẽ), mọi chức năng của `FUNCTION_REGISTRY` có đường vào menu, icon đã đăng ký; người dùng chỉ thấy chức năng có quyền Xem, và mục ẩn / tắt (chức năng, nhóm, phân hệ) không hiện |

Chạy: `dotnet test tests/Core.Tests/Core.Tests.csproj --filter "FullyQualifiedName~Menu"` trong `ServerService/`.

---

## 11. Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp |
| --- | --- |
| Chức năng mới không có trong menu | Chưa thêm vào `menu.json`, backend chưa khởi động lại, hoặc `subKey` khác mã chức năng; hoặc tài khoản chưa có quyền Xem |
| Nút hiện icon mặc định | Tên icon chưa đăng ký trong `DynamicIcon.tsx` |
| Không thấy tab *Cấu trúc menu* | Không phải super admin (kiểm tra `Security:SuperAdmin` và vai trò ADMIN) |
| Lưu bị báo 403 | Tài khoản không phải super admin |
| Lưu bị báo "Mục này cần để vào được màn hình quản lý menu..." | Đang tắt hoặc chuyển mục được bảo vệ (mục 5.5) |
| Sửa trong database nhưng menu không đổi | Đệm menu (mục 9): chờ tối đa 10 phút hoặc khởi động lại backend |
| Nhóm đã xóa trong database lại xuất hiện | Nhóm có trong `menu.json`, bộ nạp thêm lại khi khởi động. Hãy tắt nhóm thay vì xóa |
| Sidebar trống sau đăng nhập | Tải menu lỗi (thử lại một lần, sau đó hiện thông báo lỗi); kiểm tra backend và mạng |
