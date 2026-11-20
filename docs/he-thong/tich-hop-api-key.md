# Khóa API: cho robot và hệ thống khác gọi vào S-ERP

Tài liệu này dành cho người **cấp khóa** (quản trị viên cao nhất), người **viết phần mềm của robot / hệ thống bên ngoài** và người **đưa hệ thống ra ngoài mạng nội bộ**. Nếu chỉ cần cấp một khóa, đọc mục 2 và 3.

---

## 1. Khóa API là gì, khi nào dùng

Người dùng đăng nhập bằng tên và mật khẩu rồi nhận một phiên làm việc. Cách đó không hợp với **máy**: phiên tự hết khi để lâu không thao tác, mật khẩu hết hạn, đăng nhập sai nhiều lần bị chặn tạm, và mỗi lần đăng nhập bị giới hạn 10 lần mỗi phút mỗi IP.

**Khóa API** là cách đăng nhập thứ hai, dành cho máy: máy gửi một chuỗi khóa trong header `X-Api-Key` ở **mỗi lần gọi**, không có phiên, không hết hạn vì để lâu không dùng, không cần mật khẩu.

Dùng khi: robot kho báo lấy / cất hàng, ứng dụng của robot tự lập phiếu điều chuyển kho, hoặc một hệ thống khác đẩy dữ liệu vào S-ERP.

**Khóa chỉ gọi được ba phiếu điều chuyển kho** (lệnh điều chuyển, phiếu xuất điều chuyển, phiếu nhập điều chuyển) và các danh sách chọn của chúng (`GET /api/lookups/...`). Nó không vào được màn quản trị, người dùng, báo cáo hay các phiếu khác, kể cả khi vai trò của nó được phép.

---

## 2. Cách hoạt động

```
Robot ──[X-Api-Key + Idempotency-Key]──▶ S-ERP
                                          │ 1. tìm khóa (so băm SHA-256), kiểm tra bật / hạn dùng / địa chỉ IP
                                          │ 2. chạy như TÀI KHOẢN MÁY của khóa, trong ĐƠN VỊ của khóa
                                          │ 3. chỉ cho gọi phạm vi TRANSFER (ba phiếu điều chuyển)
                                          │ 4. quyền của tài khoản máy quyết định phiếu được làm đến trạng thái nào
                                          ▼
                            phiếu lập bởi "api-<mã khóa>", ghi nhật ký như người thường
```

| Thành phần | Ý nghĩa |
| --- | --- |
| **Tài khoản máy** | Một dòng trong danh sách người dùng (`api-<mã khóa>`), tạo cùng lúc với khóa. **Không đăng nhập bằng mật khẩu được**, không bị tự đăng xuất, không hết hạn mật khẩu. Có vai trò và đơn vị như một người. |
| **Vai trò** | Quyết định khóa làm được gì: quyền chức năng (Xem / Thêm / Sửa...) và **quyền trạng thái phiếu theo đơn vị** (Duyệt, Ghi sổ...). Phiếu nhập kho, xuất kho đều chạy đúng quy tắc kho như người dùng (không âm kho, khóa sổ tháng, lô, vị trí). |
| **Đơn vị cơ sở** | Mọi lệnh của khóa chạy trong một đơn vị cố định, chọn lúc cấp khóa. |
| **Phạm vi** | Hiện có `TRANSFER`. |
| **Địa chỉ IP** | Tùy chọn: danh sách địa chỉ hoặc dải (`10.0.0.5, 192.168.1.0/24`). Để trống = gọi từ đâu cũng được. |
| **Ngày hết hạn** | Tùy chọn. Quá hạn thì khóa bị từ chối. |
| **Khóa** | `serp_` + 8 ký tự nhận diện + `_` + 40 ký tự ngẫu nhiên. **Hệ thống chỉ lưu bản băm**, khóa chỉ hiện đúng một lần lúc tạo hoặc đổi. |

Mọi thay đổi khóa (tạo, bật / tắt, sửa, xóa) ghi vào **Nhật ký thay đổi** (đối tượng `apiClient`). Lần dùng cuối và địa chỉ gọi hiện trong danh sách khóa.

---

## 3. Cấp một khóa, từng bước

Chỉ **quản trị viên cao nhất** (tài khoản nêu trong `Security:SuperAdmin`, mặc định `admin`) thấy tab **Khóa API** trong Cài đặt › Quản lý người sử dụng & phân quyền. Người khác không thấy tab, và API từ chối.

### 3.1. Tạo vai trò cho robot (một lần)

1. Tab **Vai trò** › Thêm vai trò, ví dụ `ROBOT-KHO`.
2. Bật quyền **Xem, Thêm, Sửa** cho `Lệnh điều chuyển kho`, `Phiếu xuất điều chuyển kho`, `Phiếu nhập điều chuyển kho` (thêm **Xóa** nếu robot cần hủy bản nháp). Tắt mọi chức năng khác.
3. Phần quyền đặc biệt: cấp **quyền trạng thái theo đơn vị** cho đúng đơn vị robot làm việc. Muốn robot lập phiếu và ghi sổ luôn, cấp `Ghi sổ` cho phiếu xuất và phiếu nhập điều chuyển của đơn vị đó (quyền ghi sổ đã gồm các bước duyệt trước nó). Muốn người kiểm lại rồi mới ghi sổ, chỉ cấp `Chờ duyệt` hoặc không cấp gì: robot lập bản nháp, người có quyền duyệt và ghi sổ.

> **Nguyên tắc:** cấp cho robot **ít quyền nhất đủ làm việc**. Vai trò quản trị (`ADMIN`) không được dùng cho khóa.

### 3.2. Thêm khóa

1. Tab **Khóa API** › **Thêm khóa**.
2. Điền: **Mã khóa** (ví dụ `ROBOT-KHO1`), **Tên** (bên sử dụng), **Vai trò** (vừa tạo), **Đơn vị cơ sở**, và nên điền **Địa chỉ IP được gọi** và **Ngày hết hạn**.
3. **Tạo khóa.** Hộp thoại hiện khóa **một lần duy nhất**: sao chép ngay và đưa cho bên robot qua kênh an toàn (không gửi qua email thường hay chat nhóm). Khóa không xem lại được.

### 3.3. Quản lý sau đó

| Việc | Cách làm |
| --- | --- |
| Tạm dừng | Nút nguồn trên dòng khóa: khóa bị từ chối ngay, bật lại khi cần. |
| Khóa bị lộ hoặc mất | **Đổi khóa**: khóa cũ ngừng ngay, khóa mới hiện một lần. |
| Robot ngừng dùng | **Xóa**: khóa bị xóa, tài khoản máy bị tắt và đổi tên (`deleted-...`); phiếu nó đã lập vẫn giữ "người lập". Mã khóa dùng lại được. |
| Đổi quyền | Sửa vai trò `ROBOT-KHO` ở tab Vai trò: có hiệu lực ngay cho mọi khóa dùng vai trò đó. |

---

## 4. Gọi API

Mọi lần gọi gửi header:

| Header | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `X-Api-Key` | Có | Khóa. Không gửi `Authorization`. |
| `Idempotency-Key` | **Có với mọi `POST` tạo phiếu** | Mã riêng của mỗi lệnh (xem 4.2). Tối đa 200 ký tự. |
| `Content-Type: application/json` | Có với `POST` / `PUT` | |

### 4.1. Luồng điều chuyển kho

Phiếu có ba bước, mỗi bước một phiếu; robot thường chỉ cần hai bước cuối.

| Bước | API | Việc |
| --- | --- | --- |
| 1 | `POST /api/inventory/transfer-orders` | Lệnh điều chuyển (không ghi sổ, có thể bỏ qua). |
| 2 | `POST /api/inventory/transfer-issues` | Phiếu xuất điều chuyển: ghi sổ **xuất** kho nguồn. |
| 3 | `GET /api/inventory/transfer-receipts/open-issues` rồi `POST /api/inventory/transfer-receipts` | Phiếu nhập điều chuyển: ghi sổ **nhập** kho đích, nhận hàng từ phiếu xuất đã ghi sổ. |
| thêm | `POST .../{id}/post`, `.../cancel`, `.../reopen`, `PUT .../{id}`, `DELETE .../{id}` | Đổi trạng thái, sửa, xóa, theo quyền của vai trò. |
| thêm | `GET /api/inventory/transfer-issues/options`, `GET /api/lookups/materials` ... | Kho và danh sách chọn. |

**Ví dụ: lập và ghi sổ phiếu xuất điều chuyển** (ngày phiếu không được thuộc tháng đã khóa sổ):

```bash
curl -X POST http://may-chu:2512/api/inventory/transfer-issues \
  -H "X-Api-Key: serp_..." \
  -H "Idempotency-Key: robot1-2027-03-01-000123" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2027-03-01",
    "fromWarehouseCode": "KHO01",
    "toWarehouseCode": "KHO02",
    "reason": "Bổ sung kho sản xuất",
    "personName": "Robot 1",
    "items": [ { "materialCode": "VT001", "uomCode": "TAM", "quantity": 10 } ],
    "targetStatus": "Posted"
  }'
```

`targetStatus` là trạng thái muốn đạt: `Draft` (mặc định), `Pending`, `Approved`, `Posted`. Hệ thống làm đến đâu **quyền của vai trò cho phép**; thiếu quyền ở bước nào thì cả lệnh bị từ chối và không lưu gì (không bao giờ lưu dở).

**Phiếu nhập điều chuyển** trỏ về dòng phiếu xuất bằng `sourceLineId` (lấy từ `GET .../transfer-receipts/open-issues`):

```json
{ "date": "2027-03-02", "fromWarehouseCode": "KHO01", "toWarehouseCode": "KHO02", "reason": "Nhận hàng",
  "items": [ { "materialCode": "VT001", "uomCode": "TAM", "quantity": 10, "sourceLineId": 123 } ],
  "targetStatus": "Posted" }
```

Mô tả đầy đủ từng endpoint và quyền cần có: Swagger (`/swagger`, chỉ môi trường phát triển) hoặc `docs/kho/dieu-chuyen-kho.md`.

### 4.2. Chống ghi trùng: `Idempotency-Key`

Mạng chập chờn có thể làm robot **không nhận được phản hồi** dù phiếu đã được tạo. Gửi lại không có mã thì tạo **hai phiếu** và trừ kho hai lần. Với `Idempotency-Key`:

| Tình huống | Kết quả |
| --- | --- |
| Gửi lần đầu | Chạy bình thường, hệ thống nhớ phản hồi. |
| Gửi lại **cùng mã, cùng nội dung** | Trả **đúng phản hồi cũ**, kèm header `Idempotency-Replayed: true`. **Không tạo thêm phiếu.** |
| Cùng mã nhưng **nội dung khác** | `422`: mỗi lệnh phải có mã riêng. |
| Cùng mã khi lệnh đầu **đang xử lý** | `409`: gửi lại sau vài giây. |
| Lệnh đầu lỗi máy chủ (5xx) | Mã được giải phóng, gửi lại sẽ chạy. |

Cách đặt mã: gắn với **lệnh của robot**, không phải với lần gửi. Ví dụ `robot1-<số lệnh>` hoặc mã nhiệm vụ của hệ điều khiển robot. Phản hồi được nhớ khoảng **7 ngày**.

### 4.3. Mã trả về

| Mã | Nghĩa | Làm gì |
| --- | --- | --- |
| 200 / 204 | Thành công | |
| 400 | Dữ liệu sai hoặc vi phạm quy tắc (không đủ tồn, tháng đã khóa, sai kho...): `message` nói rõ | Sửa dữ liệu, không gửi lại nguyên văn. |
| 401 | Khóa không hợp lệ, đã tắt, hết hạn, hoặc gọi từ địa chỉ không được phép | Kiểm tra khóa và IP; liên hệ người cấp khóa. |
| 403 | Khóa không được gọi chức năng này (ngoài phạm vi), hoặc vai trò thiếu quyền | Kiểm tra đường dẫn và quyền của vai trò. |
| 409 | Phiếu đã bị sửa bởi người khác, hoặc lệnh trùng đang xử lý | Đọc lại phiếu / gửi lại sau. |
| 422 | `Idempotency-Key` đã dùng cho lệnh khác | Đổi mã. |
| 429 | Khóa gọi quá nhiều lần trong một phút (mặc định 600; header `Retry-After` cho biết số giây phải chờ) | Giảm tần suất, hoặc báo người quản trị nâng `ApiKeys:RequestsPerMinute`. |

---

## 5. Đưa ra ngoài mạng nội bộ

Backend mặc định chỉ lắng nghe `localhost:2512`. Muốn robot ở máy khác gọi vào:

1. **Đặt sau reverse proxy có HTTPS** (IIS, nginx, Caddy). Khóa đi trong header nên **bắt buộc HTTPS** khi qua mạng không tin cậy; HTTP thường để lộ khóa.
2. **Chỉ chuyển tiếp những gì robot cần**: `/api/inventory/transfer-*` và `/api/lookups/*`. Chặn mọi đường khác ở proxy (lớp bảo vệ thứ hai, ngoài phạm vi của khóa).
3. **Tường lửa hoặc VPN**: chỉ cho địa chỉ máy robot vào cổng của proxy. Không mở thẳng cổng 2512 ra internet.
4. **Khai báo proxy tin cậy** để hệ thống biết địa chỉ IP thật của robot (và giới hạn IP của khóa đúng). Trong `appsettings.Local.json`:

   ```json
   { "Network": { "KnownProxies": [ "10.0.0.2" ] } }
   ```

   Hệ thống chỉ tin header `X-Forwarded-For` từ các địa chỉ này; nếu để trống thì header bị bỏ qua (kẻ gian không giả được IP). Khi thử trên cùng máy, khai báo cả `127.0.0.1` và `::1`.
5. Proxy phải **truyền header `X-Api-Key` và `Idempotency-Key`** nguyên vẹn và truyền `X-Forwarded-For`.
6. Điền **Địa chỉ IP được gọi** của khóa là địa chỉ **ngoài** của máy robot.

Giám sát: mỗi yêu cầu có dòng log kèm tên tài khoản máy và IP (`Core/logs`); khóa bị từ chối ghi cảnh báo `API key refused (...)`.

---

## 6. Bảo mật: những điều cần giữ

- Khóa như mật khẩu của một nhân viên: **không ghi vào mã nguồn, không đưa lên git**; để trong cấu hình bí mật của máy robot.
- **Đặt ngày hết hạn** và định kỳ **Đổi khóa** (ví dụ mỗi 6 - 12 tháng). Đổi khóa cần cập nhật bên robot cùng lúc.
- **Giới hạn IP** bất cứ khi nào biết địa chỉ cố định của robot.
- **Một khóa cho mỗi robot / hệ thống**, để khóa bị lộ chỉ cần thu hồi một nơi và nhật ký biết ai làm gì.
- Vai trò **ít quyền nhất**; thêm quyền ghi sổ chỉ khi cần.
- Nghi ngờ lộ khóa: **Tắt** ngay, rồi Đổi khóa. Phiếu đã lập bởi tài khoản máy xem được trong Nhật ký thay đổi.

---

## 7. Cho lập trình viên

| Phần | Vị trí |
| --- | --- |
| Quy tắc thuần (sinh khóa, băm, danh sách IP, phạm vi) | `Core.Application/Modules/ApiClients/ApiKeyRules.cs` (+ `ApiKeyRulesTests`) |
| Xác thực `X-Api-Key`, giới hạn phạm vi, chống ghi trùng | `Core/Common/Authorization/ApiKeyAuthentication.cs` (`ApiKeyAuthenticationHandler`, `ApiClientMiddleware`) |
| Quản lý khóa | `ApiClientService`, `ApiClientsController` (`api/settings/api-clients`, chính sách `SuperAdmin`) |
| Lưu phản hồi chống ghi trùng | `IdempotencyStore`, bảng `sys_idempotency_key` (chỉ SQL, không entity) |
| Bảng | `sys_api_client`, cột `sys_users.is_service_account`, script `66-api-clients.sql` |
| Màn hình | `Frontend/src/modules/settings/permissions/ApiClientsPanel.tsx`, tab trong `UserPermissionManager.tsx` |

- Hai đường đăng nhập chung một chính sách xác thực `Smart` (`ApiServiceExtensions`): có header `X-Api-Key` thì dùng khóa, ngược lại dùng token. Khóa tạo ra cùng loại claim như token, nên **quyền, quyền trạng thái theo đơn vị, nhật ký, khóa sổ tháng chạy y như người thường**; thêm hai claim `erp_api_client` và `erp_api_scope`.
- Tài khoản máy chặn đăng nhập mật khẩu ở `AuthService.LoginAsync` (`IsServiceAccount`).
- **Thêm phạm vi mới** (ví dụ cho phép khóa gọi phiếu nhập kho): thêm hằng số vào `ApiKeyScopes`, thêm các tiền tố đường dẫn vào `ApiKeyRules.Allows`, thêm test vào `ApiKeyRulesTests`, và thêm lựa chọn phạm vi vào form (hiện cố định `TRANSFER`).
- `ApiClientService.UpdateAsync` không kiểm tra phiên bản (ngoại lệ có lý do trong `ConcurrencyContractTests`): mỗi lần robot gọi ghi `last_used_at` vào chính dòng khóa, làm đổi phiên bản, nên form sẽ luôn bị coi là cũ.
- Kiểm tra bằng tay (đã chạy 33 bước): tạo vai trò và khóa, gọi không khóa / sai khóa / khóa tắt / sai IP, khóa gọi màn quản trị (403), lập và ghi sổ phiếu xuất rồi phiếu nhập, gửi lại cùng `Idempotency-Key` (đúng một phiếu), cùng mã khác nội dung (422), đổi khóa (khóa cũ ngừng), nhật ký thay đổi.

### Giới hạn hiện tại

- Phạm vi duy nhất là `TRANSFER`.
- Chưa có **webhook** (S-ERP chủ động báo cho hệ thống robot khi phiếu được duyệt): robot phải hỏi (`GET .../open-issues`...) hoặc nhận lệnh từ nơi khác.
- Giới hạn tần suất theo khóa (`ApiKeys:RequestsPerMinute`, mặc định 600 lần mỗi phút, 0 = tắt) đếm trong bộ nhớ của một máy chủ, nên chỉ đúng khi chạy một máy chủ (như bộ nhớ đệm và kênh thông báo).
- Phản hồi được lưu để chống ghi trùng là phản hồi của lần đầu: nếu phiếu bị sửa sau đó, gửi lại cùng mã vẫn trả bản cũ trong vòng 7 ngày.
