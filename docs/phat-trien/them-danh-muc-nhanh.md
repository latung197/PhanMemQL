# Thêm danh mục nhanh

Hai cách thêm một danh mục (master data) **không cần nhờ trợ lý**. Kết quả giống hệt nhau và giống các danh mục đang chạy (tổ sản xuất, nhóm khách hàng...): danh sách phân trang ở máy chủ, tìm không dấu, lọc, xuất / nhập Excel, xóa nhiều, nhật ký thay đổi, chống ghi đè, chặn xóa mã đang dùng, tra cứu F2, phân quyền 7 thao tác.

| Cách | Khi nào dùng | Thời gian (danh mục đơn giản) |
|---|---|---|
| **A. Chạy script** `npm run tao-danh-muc` | Hầu hết mọi danh mục: chỉ viết một file mô tả ~20 dòng | vài phút |
| **B. Chép bộ khung bằng tay** | Muốn tự làm và hiểu từng chỗ, hoặc danh mục quá đặc biệt cho script | 15 – 20 phút |

Cả hai dùng chung một bộ mẫu (`Frontend/scripts/tao-danh-muc.ts`), và chung một quy ước: mỗi chỗ phải đăng ký có sẵn một dòng chú thích **`[tao-danh-muc]`**; dòng mới luôn đặt **ngay trên** dòng đó.

Danh mục có lưới dòng con, khóa ghép, danh sách chọn nhiều, hay không phẳng (cây): làm theo hướng dẫn đầy đủ [them-danh-muc.md](them-danh-muc.md) Phần 5, hoặc tạo phần cơ bản bằng script rồi thêm tay.

---

## A. Chạy script

### A1. Viết file mô tả

Chép `docs/phat-trien/mau-danh-muc/vi-du-thuong-hieu.json` ra một chỗ bất kỳ rồi sửa:

```json
{
  "ma": "inv_brand_cat", "phanHe": "inventory", "ten": "Brand",
  "tenVi": "Danh mục thương hiệu", "tenEn": "Brands",
  "danhTu": "thương hiệu", "danhTuEn": "brand",
  "nhanMa": "Mã thương hiệu", "nhanMaEn": "Brand code",
  "nhanTen": "Tên thương hiệu", "nhanTenEn": "Brand name",
  "icon": "Tag", "doiMa": true,
  "truong": [
    { "cot": "country", "kieu": "chu", "nhan": "Quốc gia", "nhanEn": "Country", "doDai": 100 },
    { "cot": "material_group_code", "kieu": "ma", "nhan": "Nhóm vật tư", "nhanEn": "Material group",
      "tro": { "lop": "MaterialGroup", "bang": "erp_material_group", "traCuu": "materialGroups" } },
    { "cot": "note", "kieu": "ghichu", "nhan": "Ghi chú", "nhanEn": "Note" }
  ]
}
```

| Khóa | Bắt buộc | Ý nghĩa | Mặc định |
|---|---|---|---|
| `ma` | có | Mã chức năng: chữ thường, `_`, tiền tố phân hệ, đuôi `_cat`. **Không đổi về sau** | |
| `phanHe` | có | `inventory`, `purchasing`, `sales`, `production`, `finance` | |
| `ten` | có | Tên lớp C# PascalCase số ít (`Brand`) | |
| `tenSoNhieu` | | Số nhiều (`Brands`): tên tra cứu, DbSet, controller | `ten` + `s` |
| `bang` | | Bảng | `erp_` + snake_case của `ten` |
| `duongDan` | | Đoạn cuối của API và thư mục màn hình | kebab-case của `tenSoNhieu` |
| `tenVi`, `tenEn` | có | Tên menu, tiêu đề màn, tên sheet Excel | |
| `danhTu`, `danhTuEn` | có | Danh từ trong câu ("Thêm *thương hiệu*", "*Thương hiệu* không tồn tại") | |
| `nhanMa`, `nhanTen` (+ `En`) | có | Nhãn ô mã, ô tên | |
| `doDaiMa`, `doDaiTen` | | Độ dài | 20, 200 |
| `tenKhongTrung` | | Không cho hai dòng trùng tên (không phân biệt hoa thường) | `true` |
| `icon` | | Icon lucide **có sẵn** trong `components/common/DynamicIcon.tsx` | `Tag` |
| `nhomMenu` | | Id nhóm trong `menu.json` | nhóm danh mục của phân hệ (`GRP_INV_CAT`, `GRP_PUR_CATALOGS`, `GRP_SALES_CAT`, `GRP_PROD_CATALOGS`, `GRP_FIN_CAT`) |
| `doiMa` | | Cho phép đổi mã / gộp mã (quyền `CHANGE_CODE`) | `false` |
| `tenFile` | | Tên file Excel | `tenVi` bỏ dấu, viết liền |
| `viDuMa`, `viDuTen` | | Giá trị mẫu trong file Excel mẫu | |
| `truong` | | Các cột thêm (ngoài mã, tên, đang dùng, thứ tự) | không có |

**Các kiểu trường** (`kieu`):

| Kiểu | Cột SQL | Ô trên màn | Tùy chọn |
|---|---|---|---|
| `chu` | `ud_text<doDai>` | ô chữ | `doDai` (100), `batBuoc`, `khongTrung` (không trùng, bỏ qua hoa thường) |
| `ghichu` | `ud_text<doDai>` | ô nhiều dòng | `doDai` (300), `batBuoc` |
| `so` | `ud_dec18_<soLe>`, mặc định 0 | ô số | `soLe` (2) |
| `nguyen` | `integer`, mặc định 0 | ô số nguyên | |
| `logic` | `ud_bool`, mặc định false | ô tick | |
| `ngay` | `date` | ô ngày | `batBuoc` |
| `ma` | `ud_code<độ dài mã của danh mục đích>` + chỉ mục + `[References]` | ô tra cứu F2 | `tro`: `{ "lop": lớp C# của danh mục đích, "bang": bảng đích, "traCuu": tên tra cứu }`, `batBuoc`. **Tên cột phải kết thúc bằng tên bảng đích bỏ `erp_` / `sys_` + `_code`** (ví dụ `material_group_code` trỏ `erp_material_group`) |

Mỗi trường có `cot` (snake_case), `nhan`, `nhanEn`, và `viDu` (giá trị mẫu Excel) tùy chọn. Không đặt cột `code`, `name`, `is_active`, `sort_order`, dấu bản ghi: khung đã có.

### A2. Chạy

```bash
cd Frontend
npm run tao-danh-muc -- duong/dan/mo-ta.json --thu
```

`--thu` chỉ in ra các tệp sẽ tạo / sửa, không ghi gì. Script kiểm trước và dừng nếu mã chức năng, bảng, tra cứu, nhóm chữ, icon hoặc nút menu đã có. Đúng thì chạy thật:

```bash
npm run tao-danh-muc -- duong/dan/mo-ta.json
```

Script tạo **8 tệp** (script SQL số tiếp theo, thực thể, hợp đồng, dịch vụ, controller, `api.ts`, màn hình, `index.ts`) và chèn vào **15 tệp** đăng ký (16 khi cho đổi mã). Cuối cùng nó in danh sách việc còn lại:

1. Chạy script SQL vừa tạo trên database (`psql ... -f ServerService/sql/postgresql/NN-<phân hệ>-<tên>.sql`).
2. Dừng backend; `cd ServerService && dotnet build Core.sln && dotnet test tests/Core.Tests/Core.Tests.csproj`.
3. `cd Frontend && npm run lint && npm run check-i18n && npm run check-menu`.
4. Khởi động lại backend (mã chức năng và nút menu vào `sys_command` khi khởi động), mở menu.

### A3. Không đúng ý thì hoàn tác

Trước khi ghi, script chép các tệp nó sắp sửa vào `.tao-danh-muc/<mã>/` (không vào git). Ngay sau khi tạo, nếu muốn bỏ:

```bash
npm run tao-danh-muc -- --hoan-tac inv_brand_cat
```

Tệp mới bị xóa, tệp đã sửa trở lại đúng như trước. **Chỉ dùng khi chưa sửa thêm gì** vào các tệp đó (hoàn tác ghi đè bằng bản cũ). Đã chạy script SQL thì `DROP TABLE` bảng đó; đã khởi động backend thì xóa dòng mã chức năng trong `sys_command`. Đúng ý thì xóa thư mục `.tao-danh-muc/<mã>`.

### A4. Sau khi tạo

- **Màn khác cần chọn mã từ danh mục này**: thêm mã chức năng của màn đó vào `Rule("<tra cứu>", "<mã>", [...])` trong `ServerService/Core.Application/Common/Lookups/LookupAccess.cs` (nếu không, người không phải quản trị bị 403 ở ô chọn), rồi dùng `<CatalogLookup lookup="<tra cứu>" ... />` trên màn đó.
- **Luật riêng** (kiểm tra thêm, tự điền...): viết trong `ApplyAsync` của dịch vụ vừa tạo; thông báo lỗi là khóa ở `Messages.vi.json` / `Messages.en.json`.
- **Cấp quyền** cho vai trò ở Cài đặt › Người dùng & phân quyền.
- **Tài liệu**: mô tả bảng trong từ điển cơ sở dữ liệu (`docs/cong-cu/gen-database-doc.cjs`), dòng "Backend-backed" của `CLAUDE.md` nếu cần.

---

## B. Chép bộ khung bằng tay

### B1. Chép 8 tệp và thay tên

Bộ khung ở `docs/phat-trien/mau-danh-muc/` (dựng lại bằng `npm run tao-danh-muc -- --khung`). Mỗi tệp đã đánh số theo thứ tự làm. Chép sang đúng chỗ, đổi tên tệp, rồi **Tìm – Thay** (phân biệt hoa thường) các chỗ `{{...}}`:

| Chỗ thay | Ví dụ | Ý nghĩa |
|---|---|---|
| `{{ma}}` | `inv_brand_cat` | mã chức năng |
| `{{MA_IN_HOA}}` | `INV_BRAND_CAT` | mã chức năng viết hoa (id nút menu) |
| `{{phanHe}}` / `{{PhanHe}}` | `inventory` / `Inventory` | phân hệ |
| `{{Ten}}` / `{{ten}}` | `Brand` / `brand` | tên số ít (lớp C#) / chữ đầu thường (loại đối tượng nhật ký, tiền tố thông báo) |
| `{{Tens}}` / `{{tens}}` | `Brands` / `brands` | số nhiều (DbSet, controller) / tên tra cứu, nhóm chữ màn hình |
| `{{kebab}}` | `brands` | đoạn cuối API, thư mục màn hình |
| `{{bang}}` | `erp_brand` | bảng |
| `{{tenVi}}`, `{{tenEn}}`, `{{danhTu}}`, `{{DanhTu}}`, `{{danhTuEn}}`, `{{nhanMa}}`, `{{nhanTen}}`... | | chữ hiển thị (như mục A1) |
| `{{tenFile}}` | `DanhMucThuongHieu` | tên file Excel |
| `{{Icon}}` | `Tag` | icon lucide có trong `DynamicIcon.tsx` |

| Tệp khung | Chép đến |
|---|---|
| `1-NN-phan-he-ten.sql` | `ServerService/sql/postgresql/<số tiếp theo>-<phân hệ>-<kebab>.sql` |
| `2-{{Ten}}.cs` | `ServerService/Core.Domain/Modules/<PhanHe>/Categories/<Ten>.cs` |
| `3-{{Ten}}Contracts.cs` | `ServerService/Core.Application/Modules/<PhanHe>/Categories/<Ten>Contracts.cs` |
| `4-{{Ten}}Service.cs` | `ServerService/Core.Infrastructure/Modules/<PhanHe>/Categories/<Ten>Service.cs` |
| `5-{{Tens}}Controller.cs` | `ServerService/Core/Modules/<PhanHe>/Categories/<Tens>Controller.cs` |
| `6-api.ts`, `7-{{Ten}}CategoryView.tsx`, `8-index.ts` | `Frontend/src/modules/<phân hệ>/categories/<kebab>/` |

Khung có sẵn cột ví dụ `note` (ghi chú): xóa đi hoặc nhân lên cho các cột của mình. Mỗi cột có mặt ở: SQL, thuộc tính thực thể, DTO + request, `ApplyAsync` / `MapAsync` / `ExportColumns` / `Search` của dịch vụ, `api.ts` (hai kiểu), màn hình (cột, ô form, cột Excel, `toInput`, `emptyInput`, `normalize`). Cách viết từng kiểu cột: xem mục A1 hoặc chạy thử script với `--thu` rồi mở tệp nó tạo.

### B2. Dán 11 chỗ đăng ký

Dán **ngay trên** dòng có `[tao-danh-muc]` trong mỗi tệp:

| # | Tệp | Dòng dán |
|---|---|---|
| 1 | `ServerService/Core.Application/Common/Permissions/FunctionCatalog.cs` | `["{{ma}}"] = "{{tenVi}}",` |
| 2 | `ServerService/Core.Infrastructure/Common/Persistence/CoreContext.cs` | `public DbSet<Core.Domain.Modules.{{PhanHe}}.{{Ten}}> {{Tens}} => Set<Core.Domain.Modules.{{PhanHe}}.{{Ten}}>();` |
| 3 | `ServerService/Core.Infrastructure/DependencyInjection.cs` | `services.AddScoped<Core.Application.Modules.{{PhanHe}}.Categories.I{{Ten}}Service, Core.Infrastructure.Modules.{{PhanHe}}.Categories.{{Ten}}Service>();` |
| 4 | `ServerService/Core.Infrastructure/Common/Lookups/LookupCatalogs.cs` | `new LookupDefinition("{{tens}}", db => db.{{Tens}}.Select(x => new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive }), ["{{bang}}"]),` |
| 5 | `ServerService/Core.Application/Common/Lookups/LookupAccess.cs` | `Rule("{{tens}}", "{{ma}}"),` (màn nào chọn mã từ danh mục này thì thêm mảng thứ ba, ví dụ `["inv_receipt"]`) |
| 6 | `ServerService/Core.Application/Common/Permissions/SpecialRightCatalog.cs` | `"{{ma}}",` (**chỉ khi** cho đổi mã / gộp mã; khi đó dịch vụ thêm `, CodeChange: true` vào `CatalogSpec` và màn hình thêm `codeChange: { lookup: '{{tens}}' },`) |
| 7 | `Frontend/src/types/index.ts` | `\| '{{ma}}'   // {{tenVi}}` |
| 8 | `Frontend/src/config/functions.ts` | `{{ma}}: fn('{{phanHe}}', '/{{phanHe}}/{{kebab}}', '{{tenVi}}', 'catalog'),` |
| 9 | `Frontend/src/modules/<phân hệ>/<PhanHe>Module.tsx` (2 dòng đánh dấu) | trên dòng "Import...": `import { {{Ten}}CategoryView } from './categories/{{kebab}}/{{Ten}}CategoryView';` — trên dòng "Màn của...": `case '{{ma}}': return <{{Ten}}CategoryView currentUser={currentUser} />;` |
| 10 | `ServerService/Core/SeedData/menu.json` | vào `items` của nhóm danh mục của phân hệ: `{ "id": "MNU_{{MA_IN_HOA}}", "subKey": "{{ma}}", "titleVi": "{{tenVi}}", "titleEn": "{{tenEn}}", "icon": "{{Icon}}", "orderNo": <lớn nhất + 10>, "isActive": true }` |
| 11 | Chữ và thông báo | theo `9-chu-va-thong-bao.json` của bộ khung: `messagesVi` → cuối `Messages.vi.json`, `messagesEn` → cuối `Messages.en.json` (thêm khóa của từng cột: `field.{{ten}}<Cột>`, `export.{{ten}}.<cột>`); `screenVi` / `screenEn` → nhóm `"{{tens}}"` trong `Frontend/src/locales/<vi\|en>/<phân hệ>.json` (Tài chính: `common.json`); `common.json` cả hai: `audit.objectType.{{ten}}`, bản en thêm `function.{{ma}}` |

Rồi làm các bước kiểm tra như mục A2 (chạy SQL, build, test, `lint`, `check-i18n`, `check-menu`, khởi động lại backend) và mục A4.

---

## Kiểm tra đã làm khi dựng công cụ

Danh mục thử có đủ 7 kiểu trường (chữ không trùng, ghi chú, số 4 số lẻ, số nguyên, đúng / sai, ngày, mã trỏ nhóm vật tư) và đổi mã. Script tạo xong thì build sạch ngay, test backend đạt hết, `lint` / `check-i18n` / `check-menu` sạch, script SQL chạy hai lần không lỗi. Thử thật trên API:

- tạo đủ kiểu, trùng tên / trùng tên gọi khác / trùng mã bị từ chối, mã nhóm vật tư không có bị từ chối, mã gõ thường được viết hoa;
- sửa có phiên bản, phiên bản cũ → 409;
- phân trang, sắp xếp theo cột sinh ra, tìm kiếm, cột lạ → 400;
- tra cứu F2, xuất Excel, đổi mã, xóa nhiều;
- nhóm vật tư đang được dùng không xóa được.

Thử luôn màn hình và menu. Hoàn tác trả các tệp về đúng từng byte như trước.
