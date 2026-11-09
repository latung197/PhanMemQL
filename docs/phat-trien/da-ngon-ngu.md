# Đa ngôn ngữ trong S-ERP: cách hoạt động, các luồng làm và tình trạng

Tài liệu cho người quản trị (thêm ngôn ngữ, sửa bản dịch) và lập trình viên (làm màn hình, thông báo, danh mục mới sao cho dùng được nhiều ngôn ngữ). Đúng với code hiện tại (11/2026).

Mục lục: 1 Khái niệm · 2 Ngôn ngữ của một yêu cầu đi thế nào · 3 Bốn lớp chữ và nơi để · 4 Các luồng làm từng bước (L1 – L9) · 5 Kiểm tra · 6 Tình trạng: chức năng nào đã / chưa · 7 Giới hạn đã biết · 8 Việc nên làm tiếp.

---

## 1. Khái niệm

- **Ngôn ngữ** là một dòng của danh mục `sys_language` (Cài đặt › Ngôn ngữ): mã (`vi`, `en`, `ja`, `zh-cn`...), tên, tên bản ngữ, đang dùng, **mặc định** (đúng một ngôn ngữ, hiện là tiếng Việt). Đang có hai ngôn ngữ: `vi` và `en`.
- Mỗi người dùng có **ngôn ngữ riêng** (`sys_users.language`; trống = ngôn ngữ mặc định của công ty). Chọn ở ô ngôn ngữ trên trang đăng nhập hoặc thanh đầu trang; thanh đầu trang lưu vào hồ sơ qua `PUT /api/auth/me/language`.
- **Quy tắc lùi (fallback)**: thiếu chữ ở ngôn ngữ đang chọn thì lấy tiếng Việt, rồi mới hiện chính khóa. Nên thiếu bản dịch **không làm lỗi**, chỉ hiện tiếng Việt.
- Ngôn ngữ chia theo gốc: `zh-cn` thiếu thì thử `zh`, rồi `vi`.
- Phạm vi đã thống nhất (ghi 01/10/2026): làm đa ngôn ngữ cho **phần dùng chung và Cài đặt**; các phân hệ khác (Kho chứng từ, Mua hàng chứng từ, Bán hàng, Tài chính, Nhân sự, Báo cáo) làm sau, từng chức năng khi được làm lại. Danh mục Kho, Mua hàng, Bán hàng đã làm khi chuyển lên backend. Xem mục 6 để biết chính xác từng chức năng.

## 2. Ngôn ngữ của một yêu cầu đi thế nào

```
Người dùng chọn ngôn ngữ (đăng nhập / thanh đầu trang)
   │  lưu localStorage["serp_language"] và hồ sơ (sys_users.language)
   ▼
Frontend: storedLanguage() ──► mọi gọi API gửi header  Accept-Language: en
   │                              │
   │ chữ trên màn: t('khóa')      ▼
   │ (locales/<mã>/*.json)   Backend (Program.cs): Messages.CurrentLanguage = Accept-Language
   ▼                              │
Màn hiện chữ theo ngôn ngữ        ├─ lỗi / thông báo:      Messages.T("khóa", đối số)
                                  ├─ tên đã dịch của dữ liệu: bảng *_translation theo CurrentLanguage
                                  ├─ tên menu:              sys_command_translation theo CurrentLanguage
                                  └─ thông báo gửi cho người khác: Messages.Format(ngôn ngữ của NGƯỜI NHẬN, ...)
```

Ba điều dễ nhầm:
1. Backend lấy ngôn ngữ từ **header `Accept-Language` của từng yêu cầu**, không đọc hồ sơ. Frontend luôn gửi ngôn ngữ đang chọn (kể cả chưa đăng nhập).
2. Dịch vụ chạy nền (dọn thông báo, dọn nhật ký) không có yêu cầu nên dùng tiếng Việt.
3. Thông báo tạo cho người khác (ví dụ "có phiếu cần duyệt") được dựng bằng ngôn ngữ **của người nhận** (`Messages.Format(người nhận.language, khóa, ...)`), không phải của người bấm.

## 3. Bốn lớp chữ và nơi để

| Lớp | Chữ gì | Nơi để | Ai sửa |
| --- | --- | --- | --- |
| **A. Chữ trên màn hình** | Tiêu đề, nút, nhãn, thông báo của màn, tiêu đề cột | `Frontend/src/locales/<mã>/{common,settings,inventory,purchasing,sales}.json`, gọi bằng `t('khóa')` | Lập trình viên (file) |
| **B. Chữ máy chủ gửi về** | Lỗi nghiệp vụ, nhãn trường, tiêu đề cột Excel xuất, tên bảng trong thông báo "đang được dùng", tên chức năng / loại phiếu / quyền đặc biệt bằng tiếng Anh, thông báo | `ServerService/Core.Application/Common/Localization/Messages.<mã>.json` | Lập trình viên (file) |
| **C. Tên của dữ liệu** | Tên đơn vị tính, loại kho, đơn vị cơ sở, tên menu theo ngôn ngữ; thông báo đăng nhập, thanh thông báo, tên trạng thái chứng từ, tiêu đề cột lưới chứng từ có ô tiếng Anh riêng | Bảng `erp_uom_translation`, `erp_warehouse_type_translation`, `sys_company_unit_translation`, `sys_command_translation` và các cột `*_en` của `sys_login_notice`, `sys_banner`, `sys_voucher_status`, `sys_voucher_grid_column` | **Người dùng nhập trên màn hình** |
| **D. Định dạng** | Ngày, số, tiền | Số / tiền: Cài đặt › định dạng số (theo công ty, không theo ngôn ngữ); ngày: `utils/format.ts` (đang cố định dạng Việt `dd/MM/yyyy`) | Xem mục 7 |

Quy tắc chọn lớp: **chữ của chương trình** (cố định, do lập trình viên viết) vào A hoặc B; **chữ của dữ liệu** (do người dùng nhập, đổi theo tổ chức) vào C. Không bao giờ đặt chữ dữ liệu vào file ngôn ngữ.

Các khác biệt nhỏ giữa A và B:

| | A (frontend) | B (backend) |
| --- | --- | --- |
| Cú pháp đối số | `{tên}`: `t('lots.editTitle', { code })` | `{0}`, `{1}`: `new BusinessRuleException("lot.codeExists", code)` |
| Dạng file | JSON lồng nhau, khóa nối bằng dấu chấm (`lots.title`) | JSON phẳng (`"lot.notFound": "..."`) |
| Thiếu khóa | Lùi về tiếng Việt, rồi hiện khóa | Như vậy; riêng `EveryLanguageHasEveryText` báo đỏ test |
| Công cụ kiểm tra | `npm run check-i18n` | `MessagesTests` trong `dotnet test` |

## 4. Các luồng làm từng bước

### L1. Thêm một ngôn ngữ mới (ví dụ tiếng Nhật `ja`)

**Người quản trị:**
1. Cài đặt › **Ngôn ngữ** › thêm: mã `ja`, tên "Japanese", tên bản ngữ "日本語", đang dùng. Từ lúc này `ja` hiện ở ô chọn ngôn ngữ (cả trang đăng nhập). Chưa có file thì mọi chữ hiện tiếng Việt.
2. Nhập tên đã dịch của dữ liệu: ở **Đơn vị tính**, **Loại kho**, **Đơn vị cơ sở** (mỗi bản ghi có ô tên cho từng ngôn ngữ), **Quản lý menu › Cấu trúc menu** (tên menu), thông báo đăng nhập, thanh thông báo, trạng thái chứng từ.

**Lập trình viên:**
3. Frontend: tạo thư mục `Frontend/src/locales/ja/` với đủ **5 file** như `vi` (`common`, `settings`, `inventory`, `purchasing`, `sales`), cùng khóa, chữ đã dịch (sao chép từ `en` rồi dịch).
4. Đăng ký trong `Frontend/src/utils/i18n.ts`:
   ```ts
   import jaCommon from '../locales/ja/common.json';
   import jaSettings from '../locales/ja/settings.json';
   import jaInventory from '../locales/ja/inventory.json';
   import jaPurchasing from '../locales/ja/purchasing.json';
   import jaSales from '../locales/ja/sales.json';
   // ...
   const FILES: Record<Language, Texts[]> = {
     vi: [...], en: [...],
     ja: [jaCommon, jaSettings, jaInventory, jaPurchasing, jaSales],
   };
   ```
5. Backend: tạo `ServerService/Core.Application/Common/Localization/Messages.ja.json` có **đủ mọi khóa** của `Messages.vi.json` (file được nhúng tự động bởi mẫu `Messages.*.json` trong `Core.Application.csproj`, không phải sửa csproj). Tên chức năng (`function.<mã>`) và loại phiếu (`voucher.<loại>`) cũng phải có.
6. Chạy `npm run check-i18n` (báo thiếu khóa) và `dotnet test` (test `EveryLanguageHasEveryText` báo thiếu / thừa khóa), rồi mở thử bằng cách chọn ngôn ngữ.

Mẹo: chưa dịch kịp thì **không tạo file**; ngôn ngữ vẫn dùng được với chữ tiếng Việt. Đã tạo file thì phải đủ khóa (test báo đỏ nếu thiếu).

### L2. Làm một màn hình mới có đa ngôn ngữ (frontend)

1. Đặt chữ vào đúng file khu vực, **cùng khóa ở mọi ngôn ngữ**: Kho → `inventory.json`, Mua hàng → `purchasing.json`, Bán hàng → `sales.json`, Cài đặt → `settings.json`, chung → `common.json`. Đặt khóa theo tên màn: `lots.title`, `lots.add`...
   ```json
   // locales/vi/inventory.json            // locales/en/inventory.json
   "stockNorms": {                          "stockNorms": {
     "title": "Định mức tồn kho",             "title": "Stock norms",
     "editTitle": "Sửa định mức {code}"       "editTitle": "Edit norm {code}"
   }                                        }
   ```
2. Trong component dùng `useLanguage`:
   ```tsx
   const { t } = useLanguage();
   <h1>{t('stockNorms.title')}</h1>
   <Modal title={t('stockNorms.editTitle', { code: row.code })} />
   ```
   Ngoài React (service, `apiClient`) dùng `translate('khóa', { tham_số })` từ `utils/i18n.ts`.
3. Với màn danh mục (`CatalogScreen`): mọi chữ trong `CatalogDefinition` (`texts`, tiêu đề cột, nhãn bộ lọc, tiêu đề cột Excel nhập) đều lấy từ `t(...)`; dùng `useMemo(() => ..., [t])` để đổi ngôn ngữ thì cột đổi theo. Giữ `...recordStampColumns<T>(t)` ở cuối cột. `key` của cột **không dịch** (là tên lưu bố cục).
4. Tên chức năng ở menu / thanh đường dẫn: thêm `navigation.subMenus.<mã chức năng>` vào `locales/*/common.json` (xem L6).
5. Chữ phải giữ nguyên tiếng Việt (ví dụ tên "Tiếng Việt" của chính ngôn ngữ) thì kết thúc dòng bằng `// i18n-ignore`.
6. Chạy `npm run check-i18n`: báo khóa **thiếu** ở ngôn ngữ khác, khóa dùng trong code mà **không có**, và (với phạm vi dùng chung + Cài đặt) chữ Việt còn gõ cứng.

Không làm: gõ cứng chữ Việt trong JSX; ghép câu bằng cách nối chuỗi (`'Đã xóa ' + n + ' dòng'` → dùng tham số `{n}`); đặt chữ dữ liệu vào file ngôn ngữ.

### L3. Chuyển một màn đang gõ cứng tiếng Việt sang đa ngôn ngữ

Cách làm lặp lại cho từng màn (ví dụ `DefaultConfigView`):

1. Liệt kê chữ cần chuyển: `npm run check-i18n -- --list` in từng dòng còn gõ cứng của phạm vi dùng chung + Cài đặt. Màn ngoài phạm vi (chứng từ, báo cáo...) cần mở file và tìm chữ có dấu.
2. Với mỗi chuỗi: thêm khóa vào `locales/vi/<khu>.json` (nguyên văn), thêm bản dịch vào `locales/en/<khu>.json`, thay trong code bằng `t('khóa')`.
3. Chuỗi có biến → tham số `{tên}`; chuỗi có số nhiều ("1 dòng / n dòng") → hai khóa hoặc diễn đạt trung tính ("Số dòng: {n}").
4. Chuỗi nằm **ngoài component** (hằng số ở đầu file) → chuyển thành hàm nhận `t`, hoặc chỉ giữ **khóa** trong hằng số và gọi `t(khóa)` lúc hiện.
5. Ngày giờ: dùng `formatDate` / `formatDateTime` của `utils/format.ts`; số tiền dùng `NumberFormatContext`. Không tự ghép `toLocaleString('vi-VN')` (xem mục 7).
6. Chạy `npm run lint`, `npm run check-i18n`, rồi chọn English để xem thử từng tab / hộp thoại / thông báo toast.
7. Khi cả phân hệ xong: thêm thư mục của phân hệ vào `SCOPE` trong `Frontend/scripts/check-i18n.ts` để từ nay chữ Việt gõ cứng bị báo; cuối cùng bật `--strict` cho lệnh kiểm tra.

### L4. Thêm lỗi / thông báo từ backend

1. **Không viết câu trong code.** Ném lỗi bằng khóa:
   ```csharp
   throw new BusinessRuleException("stockNorm.range");                       // không đối số
   throw new BusinessRuleException("lot.codeExists", code);                  // {0} = code
   throw new BusinessRuleException("validation.notNegative", new Text("field.minQuantity")); // đối số là nhãn dịch được
   ```
   `MessagesTests.NoVietnameseSentenceIsThrownDirectly` báo đỏ nếu có câu Việt trong `throw`.
2. Thêm khóa ở **cả hai** file:
   ```json
   // Messages.vi.json
   "stockNorm.range": "Tồn tối đa không được nhỏ hơn tồn tối thiểu.",
   "field.minQuantity": "tồn tối thiểu",
   // Messages.en.json
   "stockNorm.range": "Maximum stock cannot be less than minimum stock.",
   "field.minQuantity": "minimum stock",
   ```
3. Nhãn trường (`Guard.Required(value, 100, "field.uomName")`) là khóa `field.*`; nhãn đứng đầu câu tự viết hoa chữ đầu.
4. Cột unique bị trùng → thông báo `record.duplicate` nêu tên trường theo khóa `dbfield.<cột>`; thêm khóa này nếu chưa có.
5. Danh mục: các khóa bắt buộc `<loại>.notFound`, `<loại>.codeExists`, `export.<loại>.sheet`, `field.<...>Code`, và `table.<tên bảng>` (nếu bảng này bị bảng khác trỏ tới); xem skill `/them-danh-muc`.
6. Tiêu đề cột Excel xuất: khóa `export.<loại>.<cột>` (chữ Việt trùng tiêu đề file Excel nhập của frontend).
7. Thông báo gửi cho người khác: `Messages.Format(người nhận.Language, "khóa", args)`.
8. Chạy `dotnet test`: `EveryLanguageHasEveryText` (đủ khóa mọi ngôn ngữ), `NoVietnameseSentenceIsThrownDirectly`, và các test dùng-khóa-phải-tồn-tại.

### L5. Dịch tên của dữ liệu danh mục (bảng `*_translation`)

Mẫu có sẵn: **Đơn vị tính** (`UomService`), loại kho, đơn vị cơ sở. Tên gốc (`erp_uom.name`) luôn là **tiếng Việt** (ngôn ngữ mặc định, dùng khi thiếu bản dịch); mỗi ngôn ngữ khác có một dòng trong bảng dịch.

1. SQL (script mới, chạy lại được):
   ```sql
   CREATE TABLE IF NOT EXISTS erp_xxx_translation (
       xxx_code varchar(20) NOT NULL,
       language_code varchar(10) NOT NULL,
       name varchar(100) NOT NULL,
       created_at timestamptz NOT NULL DEFAULT now(), created_by integer,
       updated_at timestamptz, updated_by integer,
       PRIMARY KEY (xxx_code, language_code)
   );
   CREATE INDEX IF NOT EXISTS ix_erp_xxx_translation_language ON erp_xxx_translation (language_code);
   ```
2. Entity: khóa ghép; `[References<Xxx>(BlocksDelete = false)]` và `[References<Language>(BlocksDelete = false)]` (bảng dịch không chặn xóa danh mục cha / ngôn ngữ), `[Audited(...)]`; đăng ký `DbSet` và `HasKey(x => new { x.XxxCode, x.LanguageCode })` trong `CoreContext`.
3. DTO: thêm `Name` (tên gốc), `LocalizedName` (tên theo ngôn ngữ yêu cầu) và `Translations` (danh sách `{ languageCode, name }`); request có `Translations` (null = giữ nguyên bản dịch cũ, để Excel nhập không xóa bản dịch).
4. Service (`MapAsync`, `AfterApplyAsync`, `BeforeDeleteAsync`), theo `UomService`:
   - đọc bản dịch của cả trang một lần; `LocalizedName` = bản dịch theo `Messages.CurrentLanguage`, lùi về gốc ngôn ngữ (`zh-cn` → `zh`) rồi tên gốc;
   - `ApplyTranslationsAsync`: kiểm ngôn ngữ có trong `sys_language`, không cho dịch tiếng Việt (gốc), mỗi ngôn ngữ một dòng, thêm / sửa / xóa theo danh sách gửi lên;
   - `AfterApplyAsync` đánh dấu bản ghi cha đã đổi (`IsModified = true`) để tăng `Version`, tránh hai người sửa đè bản dịch;
   - `BeforeDeleteAsync` xóa bản dịch của bản ghi bị xóa;
   - `Search` tìm cả trong bản dịch.
5. Tra cứu (ô chọn mã) trả `LocalizedName`; viết `LookupProvider` có `Tables` gồm cả bảng dịch để bộ nhớ đệm tự xóa khi dịch lại (xem `UomFullLookup`). Bộ nhớ đệm của tra cứu chia theo **tên và ngôn ngữ**.
6. Frontend: trong form thêm khối "Bản dịch": mỗi ngôn ngữ đang dùng (trừ ngôn ngữ mặc định) một ô tên (mẫu `UomCategoryView`: `languages` từ `useLanguage()`); cột danh sách hiện `localizedName`.
7. Màn khác (phiếu, báo cáo) muốn hiện tên theo ngôn ngữ phải đọc `localizedName` / tra cứu, không đọc cột `name` gốc.

Dữ liệu **không** có bảng dịch (nhóm vật tư, loại vật tư, nhà cung cấp, khách hàng, vật tư...) chỉ có một tên: ai nhập tiếng gì thì hiện tiếng đó cho mọi người. Đây là chủ ý hiện tại; cần dịch thì làm theo L5 (hoặc một bảng dịch dùng chung `sys_translation(entity, key, field, language, value)` như thiết kế đã bàn, chưa làm).

### L6. Thêm chức năng hoặc chứng từ mới: các khóa chữ phải có

| Khi làm | Khóa cần thêm | Kiểm tra |
| --- | --- | --- |
| Chức năng mới | `Messages.vi/en.json`: không cần `vi` (tên Việt lấy từ `FunctionCatalog`); `Messages.en.json`: **`function.<mã>`**. Frontend: `navigation.subMenus.<mã>` ở `locales/vi/common.json` **và** `en/common.json`. Menu: `titleVi`, `titleEn` trong `Core/SeedData/menu.json` | `EveryFunctionAndVoucherHasAnEnglishName`, `npm run check-i18n` |
| Chứng từ mới | Thêm vào `VoucherCatalog`; `voucher.<loại>` ở `Messages.en.json`; `table.<erp_bảng>` cho bảng đầu phiếu và dòng nếu bảng khác trỏ tới | như trên |
| Loại đối tượng nhật ký | `audit.objectType.<loại>` ở `locales/vi/common.json` và `en/common.json` | xem Nhật ký thay đổi |
| Quyền đặc biệt mới | `right.<textKey>.name` và `.description` ở `Messages.vi.json` và `Messages.en.json` | `SpecialRightsHaveNamesAndDescriptions` |
| Trạng thái chứng từ | Tên trạng thái mặc định: `voucherStatus.<Status>`; đơn vị tự đổi tên ở Cài đặt › Trạng thái chứng từ (có ô tiếng Anh) | màn Trạng thái chứng từ |

### L7. Sửa tên menu, tên chức năng

- Tên **hiển thị trên menu** theo từng ngôn ngữ nằm trong `sys_command_translation` (`menuid0`, `language_code`, `title`). Siêu quản trị sửa ở Cài đặt › Quản lý menu › **Cấu trúc menu** (có ô tên cho từng ngôn ngữ); mọi thay đổi ghi nhật ký. Khi khởi động, bộ nạp chỉ **thêm** dòng còn thiếu từ `menu.json` (`titleVi`, `titleEn`), không ghi đè dòng đã có.
- Tên chức năng ở màn **phân quyền** và **thanh đường dẫn** lấy từ `navigation.subMenus.<mã>` (frontend) và `function.<mã>` (backend, ngôn ngữ khác tiếng Việt).

### L8. Sửa một bản dịch có sẵn

| Cần sửa | Sửa ở đâu | Cần build / chạy lại |
| --- | --- | --- |
| Chữ trên màn | `Frontend/src/locales/<mã>/*.json` | Frontend tự nạp lại (dev) / build lại |
| Lỗi, thông báo, tiêu đề Excel xuất | `Messages.<mã>.json` | Phải **build lại backend** (file nhúng vào chương trình) |
| Tên đơn vị tính, loại kho, đơn vị cơ sở | Màn danh mục tương ứng, ô bản dịch | Không |
| Tên menu | Cấu trúc menu (siêu quản trị) | Không |
| Thông báo đăng nhập, thanh thông báo | Màn của chúng (có ô tiếng Anh) | Không |

### L9. In ấn, Excel, xuất file

- **Excel xuất từ máy chủ**: tiêu đề cột lấy từ `export.<loại>.*` theo `Accept-Language` của yêu cầu xuất.
- **Excel nhập (file mẫu)**: tiêu đề cột lấy từ `t(...)` của frontend (`excel.columns[].header`); nhập lại file xuất cùng ngôn ngữ thì khớp. Trộn ngôn ngữ giữa file xuất và nhập có thể không nhận cột.
- **In phiếu và báo cáo** (`voucherPrint.ts`, `reportPrint.ts`): hiện cố định tiếng Việt; làm đa ngôn ngữ ở giai đoạn "in song ngữ" chưa làm (mục 8).

---

## 5. Kiểm tra

| Việc | Lệnh / cách làm | Báo gì |
| --- | --- | --- |
| Khóa chữ màn hình | `cd Frontend && npm run check-i18n` | **Thiếu** khóa ở ngôn ngữ khác (đỏ), khóa dùng trong code mà không tồn tại (đỏ), khóa thừa (cảnh báo), chữ Việt còn gõ cứng trong phạm vi dùng chung + Cài đặt (báo cáo; `-- --strict` thì đỏ, `-- --list` in từng dòng) |
| Khóa chữ máy chủ | `cd ServerService && dotnet test` | `MessagesTests`: đủ khóa mọi ngôn ngữ, mọi chức năng và chứng từ có tên tiếng Anh, quyền đặc biệt có tên và mô tả, khóa dùng trong code tồn tại, không có câu Việt trong `throw` |
| Máy chủ trả đúng ngôn ngữ | `curl -H "Accept-Language: en" -H "Authorization: Bearer ..." .../api/...` rồi thử `vi`, `ja` | Lỗi, tên đã dịch đổi theo header |
| Màn hình | Chọn English ở trang đăng nhập; mở từng tab, hộp thoại, bấm thử lỗi (lưu thiếu trường, xóa bản ghi đang dùng), xem thông báo toast, tiêu đề cột Excel xuất | Không còn chữ Việt lẫn |
| Thông báo | Gửi duyệt phiếu từ người dùng `vi`, người duyệt dùng `en` | Người duyệt nhận thông báo tiếng Anh |

Số liệu hiện tại: chữ màn hình **1.693 khóa** (vi và en đủ, khớp từng khóa: common 748, settings 510, inventory 300, sales 81, purchasing 63 + khóa dùng chung); chữ máy chủ **1.243 khóa** tiếng Việt, tiếng Anh **đủ và dư 90 khóa** là tên chức năng / loại phiếu (do thiết kế: tên Việt lấy từ danh mục trong code).

## 6. Tình trạng: chức năng nào đã / chưa có đa ngôn ngữ

Kết quả quét mã nguồn (đếm dòng còn gõ cứng chữ Việt và số lời gọi `t(...)` của từng màn).

**Mức:** **Đủ** = màn, báo lỗi, tên menu đều theo ngôn ngữ · **Một phần** = có `t()` nhưng còn dòng gõ cứng · **Chưa** = màn còn tiếng Việt (tên menu, tên chức năng, báo lỗi từ máy chủ vẫn theo ngôn ngữ; chỉ nội dung màn là tiếng Việt).

### 6.1. Đã đủ

| Nhóm | Chức năng |
| --- | --- |
| Dùng chung | Đăng nhập, menu bên trái, thanh đầu trang, thông báo, tài khoản cá nhân, các control dùng chung và khung danh mục (`CatalogScreen`) |
| Cài đặt | Người dùng & phân quyền (`sys_users`), Đơn vị cơ sở, Phòng ban, Ngoại tệ, Tỷ giá, **Ngôn ngữ**, Thông báo đăng nhập, Thanh thông báo, Trạng thái chứng từ, Cấu hình lưới chứng từ, Mã thuế, Nhật ký thay đổi, Quản lý menu |
| Kho (danh mục) | Vật tư, Loại vật tư, Nhóm vật tư, Đơn vị tính (có bản dịch tên), Quy đổi đơn vị tính, **Định mức tồn kho**, Lô & hạn sử dụng, Vị trí lưu kho, Kho, Loại kho (có bản dịch tên), Nhà cung cấp |
| Mua hàng (danh mục) | Dự án, Điều khoản thanh toán, Nhóm nhà cung cấp |
| Bán hàng (danh mục) | Khách hàng, Nhóm khách hàng, Bảng giá bán |
| Tài chính | Hệ thống tài khoản kế toán (`fin_account_cat`) |

### 6.2. Một phần (có `t()` nhưng còn chữ gõ cứng)

| Chức năng | Màn / file | Dòng gõ cứng | Ghi chú |
| --- | --- | --- | --- |
| `sys_default_config` Tham số mặc định & đánh số chứng từ | `DefaultConfigView`, `NumberFormatSettings`, `VoucherNumberingPanel` | 48 + 60 + 15 | Chưa có `t()` |
| `sys_fiscal_year` Năm tài chính & khóa sổ | `FiscalYearView` | 23 | Chưa có `t()` |
| `settings_main` Hồ sơ doanh nghiệp & sao lưu | `CompanySettingsView`, `I18nDbManager` | 33 + 47 | `I18nDbManager` là màn dịch cũ (lưu localStorage), sẽ thay bằng bảng dịch dữ liệu |
| Danh mục Kho / Mua hàng / Bán hàng | các `*CategoryView` | mỗi màn 1–3 | Chỉ còn 1–3 dòng (thường tên ngôn ngữ cần giữ nguyên, hoặc chữ ở phần phụ) |
| Phiếu chung: nhãn trạng thái, nút lưu trạng thái | `VoucherStatusBadge`, `SaveStatusSelect`, `PrintMenuButton` | 1–6 | |

### 6.3. Chưa (màn còn tiếng Việt)

Sắp theo số dòng cần chuyển (ước lượng công việc):

| Phân hệ | Chức năng | Dòng gõ cứng |
| --- | --- | --- |
| **Kho – chứng từ** | Phiếu xuất kho (`inv_issue`) | 221 |
| | Phiếu nhập kho (`inv_receipt`) | 196 |
| | Điều chuyển: lệnh, xuất, nhập (`inv_transfer_*`, một màn dùng chung) | 160 |
| | Phiếu kiểm kê (`inv_audit_count`) | 158 |
| | Phiếu yêu cầu xuất kho (`inv_issue_request`) | 135 |
| | In phiếu (`voucherPrint.ts`), In tem (`StockLabelDialog`, `stockLabelPrint.ts`) | 74 + 21 |
| **Kho – phê duyệt** | 5 màn: nhập, xuất, yêu cầu xuất, điều chuyển, kiểm kê | ~11 mỗi màn |
| **Kho – báo cáo / tính toán** | 5 báo cáo (tồn kho, nhập xuất tồn, hàng nhập, hàng xuất, tuổi hàng tồn), Tính tồn kho tức thời, Tính giá trung bình tháng, khung `ReportKit` | ~10–21 mỗi màn |
| **Mua hàng** | Hóa đơn mua (`pur_invoice`) | 175 |
| | Đơn mua (`pur_order`) | 167 |
| | Yêu cầu mua (`pur_request`) | 142 |
| | 3 màn phê duyệt (yêu cầu, đơn, hóa đơn) | ~11 mỗi màn |
| | Báo cáo chi phí theo dự án, công nợ phải trả; hộp chọn "Lấy từ ..." | 32 + 25 + 12 |
| **Bán hàng** | Đơn bán hàng (`sales_orders`) | 143 |
| | Phê duyệt đơn bán | 11 |
| | Phiếu giao hàng (mock), Báo cáo doanh số (mock), `SalesModule` | 11 + 21 + 13 |
| **Tài chính** | Khoản mục thu chi, Phiếu thu, Phiếu chi, Báo cáo sổ quỹ (đều mock) | ~142 |
| **Nhân sự** | Hồ sơ nhân sự, Chấm công & lương, Báo cáo nhân sự, Đăng ký tài nguyên (đều mock) | ~95 + 178 |
| **Khác** | Bàn tổng quan (`overview_main`), Báo cáo tổng hợp, Trợ lý AI | 15 + 23 + 18 |
| **Cài đặt** | (xem 6.2) | |

Tổng quan: khoảng **2.400 dòng** chữ Việt còn gõ cứng ngoài Cài đặt; **các màn chứng từ** (9 nhóm màn, 11 loại phiếu) chiếm khoảng 1.500 dòng. Phần dùng chung + Cài đặt còn **230 dòng ở 10 file** (bảng 6.2), nhỏ nhất và nên làm trước.

### 6.4. Các thành phần khác chưa đa ngôn ngữ

| Thành phần | Hiện trạng |
| --- | --- |
| Ngày giờ | `utils/format.ts` và ~70 chỗ gọi `toLocaleString('vi-VN')` cố định dạng Việt (`dd/MM/yyyy`) |
| Số, tiền | Theo cấu hình công ty (định dạng số), không đổi theo ngôn ngữ người dùng |
| In ấn | Phiếu, tem, báo cáo in cố định tiếng Việt (chưa có in song ngữ) |
| Tên của dữ liệu | Chỉ đơn vị tính, loại kho, đơn vị cơ sở, menu, thông báo, trạng thái chứng từ có bản dịch; nhóm / loại vật tư, vật tư, nhà cung cấp, khách hàng, dự án... chỉ một tên |
| Nhãn dự phòng | `config/functions.ts` (nhãn chức năng tiếng Việt, chỉ dùng khi thiếu `navigation.subMenus.*`) |
| Dữ liệu mẫu (seed) | Nhập bằng tiếng Việt |

## 7. Giới hạn đã biết

- **Ngày giờ cố định định dạng Việt.** Người dùng English vẫn thấy `09/11/2026`. Cần đổi `formatDate`/`formatDateTime` theo ngôn ngữ (hoặc theo cấu hình công ty) và thay 70 chỗ `toLocaleString('vi-VN')` bằng hàm chung.
- **Hai cú pháp đối số** (`{tên}` ở frontend, `{0}` ở backend): không dùng lẫn.
- **Sửa `Messages.*.json` phải build lại backend.** Chữ màn hình thì không.
- **Thiếu bản dịch không báo lỗi lúc chạy**, chỉ hiện tiếng Việt; phát hiện bằng `check-i18n` và `dotnet test`.
- **Phạm vi kiểm `check-i18n`** (`SCOPE` trong `scripts/check-i18n.ts`) mới gồm dùng chung + Cài đặt; chữ gõ cứng của phân hệ khác chưa bị báo.
- **Bản dịch dữ liệu theo từng bảng**, chưa có bảng dịch dùng chung.
- Bộ lọc tìm kiếm không dấu và sắp xếp theo thứ tự chữ cái đang theo tiếng Việt.

## 8. Việc nên làm tiếp (thứ tự đề xuất)

1. **Hoàn tất Cài đặt** (230 dòng, 10 file): `DefaultConfigView`, `NumberFormatSettings`, `VoucherNumberingPanel`, `FiscalYearView`, `CompanySettingsView`; bỏ `I18nDbManager` khi đã có bảng dịch dữ liệu; rồi bật `check-i18n -- --strict`.
2. **Ngày giờ theo ngôn ngữ**: một hàm định dạng chung, thay các `toLocaleString('vi-VN')`.
3. **Báo cáo Kho và hai màn tính toán** (9 màn, ~130 dòng, dùng chung `ReportKit`): làm nhanh nhất, vì đã có khung chung và các tiêu đề cột Excel xuất đã đủ hai ngôn ngữ.
4. **Phê duyệt** (9 màn, mỗi màn ~11 dòng, cùng mẫu).
5. **Chứng từ**, từng phân hệ theo thứ tự dùng nhiều: Kho (5 phiếu), Mua hàng (3), Bán hàng (1); mỗi phiếu cần cả phần in. Làm cùng lúc với **in song ngữ** (`voucherPrint.ts`).
6. **Bảng dịch dữ liệu dùng chung** nếu cần dịch nhóm / loại vật tư, vật tư, nhà cung cấp...
7. Màn còn dữ liệu mẫu (Tài chính, Nhân sự, Giao hàng, Doanh số): dịch **cùng lúc** với khi chuyển lên backend, không dịch trước.

Mỗi lần xong một nhóm: thêm thư mục vào `SCOPE` của `check-i18n`, chạy `npm run check-i18n`, `dotnet test`, rồi cập nhật bảng ở mục 6 của tài liệu này.
