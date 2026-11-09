# Thêm một báo cáo mới (từng bước)

Hướng dẫn thêm một báo cáo đọc dữ liệu (ví dụ "Báo cáo hàng chậm luân chuyển") theo đúng cách đã làm cho các báo cáo Kho: **truy vấn viết thành hàm PostgreSQL**, mã .NET chỉ gọi hàm, giao diện dùng khung báo cáo chung. Làm theo thứ tự dưới đây thì báo cáo có sẵn: phân quyền, che giá trị tiền, xuất Excel có nhật ký, in, phân đơn vị cơ sở.

Mẫu để đối chiếu: các báo cáo Kho ([bao-cao-kho.md](../kho/bao-cao-kho.md)) và ba màn tính toán ([ton-tuc-thoi-gia-binh-quan-dinh-muc.md](../kho/ton-tuc-thoi-gia-binh-quan-dinh-muc.md)). Phân quyền: [phan-quyen.md](../he-thong/phan-quyen.md) mục C9 và C14. Đa ngôn ngữ: [da-ngon-ngu.md](da-ngon-ngu.md). Thêm danh mục và chứng từ: [them-danh-muc.md](them-danh-muc.md), [them-chung-tu.md](them-chung-tu.md).

---

## 1. Quyết định trước khi viết code

| Câu hỏi | Gợi ý |
| --- | --- |
| Tên, mã chức năng | Chữ thường, `_`, tiền tố phân hệ, loại báo cáo: `inv_report_slow`. **Không đổi về sau** (mã dùng cho menu, quyền, nhật ký) |
| Phân hệ, nhóm menu | `inventory`, `purchasing`, `sales`...; nhóm "Báo cáo" của phân hệ trong `menu.json` |
| Dữ liệu lấy từ đâu | Báo cáo kho đọc **sổ kho** (`erp_stock_movement`, số dư `erp_stock_balance`). Báo cáo mua / bán đọc phiếu đã duyệt hoặc đã ghi sổ. Không đọc dữ liệu mẫu trong trình duyệt |
| Theo đơn vị cơ sở | **Mọi báo cáo lọc theo đơn vị đang làm việc** (`unit_code` của người dùng), trừ khi báo cáo cố ý gộp |
| Có tiền không | Có giá trị / giá vốn thì phải có quyền đặc biệt `VIEW_COST` (hoặc `VIEW_PRICE` cho giá bán); không có quyền thì **trả `null`**, số lượng vẫn xem được |
| Bộ lọc | Ngày hoặc khoảng ngày, kho, nhóm vật tư, từ khóa... Mỗi bộ lọc là một tham số của hàm |
| Số dòng | Có thể lớn không? Đặt trần (`MaxRows`, hiện 20.000) và nói rõ khi vượt |
| Cách viết truy vấn | **Hàm PostgreSQL `rpt_*` (khuyên dùng)**, hoặc file SQL thuần (các báo cáo Mua hàng cũ: `Modules/Purchasing/Reports/Sql`). Xem mục 2 |
| Các báo cáo cùng chủ đề có phải khớp số nhau không | Có thì dùng chung cách tính (ví dụ dựng báo cáo mới trên `rpt_stock_nxt` như giá trung bình tháng) và ghi chú quy tắc |

**Vì sao hàm trong cơ sở dữ liệu.** Muốn đổi cách tính chỉ sửa hàm rồi chạy lại script, không cần biên dịch lại; Excel, Power BI, `psql` gọi lại đúng hàm đó; quy tắc nghiệp vụ không nằm trong SQL (khoảng ngày mặc định, mức "dưới tối thiểu", che tiền) thì nằm ở lớp quy tắc có test.

---

## 2. Cơ sở dữ liệu: viết hàm

Đặt hàm vào script của báo cáo (báo cáo kho: `sql/postgresql/55-inventory-reports.sql`) hoặc một script mới `NN-<ten>.sql`. Số `NN` phải **lớn hơn script của bảng nó đọc**: hàm đọc bảng chưa có thì `CREATE FUNCTION` hỏng (ví dụ `rpt_stock_balance` đọc `erp_stock_norm` nên nằm ở script 56, sau 55).

```sql
-- Hàng chậm luân chuyển: tồn đến một ngày mà không có xuất trong N ngày gần nhất.
DROP FUNCTION IF EXISTS rpt_stock_slow(text, date, int, text, text, text);
CREATE FUNCTION rpt_stock_slow(p_unit text, p_as_of date, p_days int, p_warehouse text, p_group text, p_search text)
RETURNS TABLE (warehouse_code text, warehouse_name text, material_code text, material_name text, uom_code text,
               quantity numeric, value numeric, last_out_date date)
LANGUAGE sql STABLE AS $$
    SELECT s.warehouse_code::text, w.name::text, s.material_code::text, m.name::text, m.uom_code::text,
           sum(s.quantity), sum(s.value),
           max(s.document_date) FILTER (WHERE s.quantity < 0 AND s.reversal_of_id IS NULL)
    FROM erp_stock_movement s
    JOIN erp_material m ON m.code = s.material_code
    LEFT JOIN erp_warehouse w ON w.code = s.warehouse_code
    WHERE s.unit_code = p_unit AND s.document_date <= p_as_of
      AND (p_warehouse IS NULL OR s.warehouse_code = p_warehouse)
      AND (p_group IS NULL OR m.material_group_code = p_group)
      AND (p_search IS NULL OR sys_search_match(s.material_code, p_search) OR sys_search_match(m.name, p_search))
    GROUP BY s.warehouse_code, w.name, s.material_code, m.name, m.uom_code
    HAVING sum(s.quantity) > 0
       AND coalesce(max(s.document_date) FILTER (WHERE s.quantity < 0 AND s.reversal_of_id IS NULL), date '1900-01-01') < p_as_of - p_days
    ORDER BY s.warehouse_code, s.material_code
$$;
```

Quy ước (đã dùng cho mọi hàm `rpt_*`):
- **`DROP FUNCTION IF EXISTS` rồi `CREATE`**: chạy lại được kể cả khi đổi cột trả về; chữ ký trong `DROP` phải đúng kiểu tham số.
- Tên `rpt_<chủ đề>`, tham số `p_*`, cột trả về `snake_case` (Dapper tự map sang PascalCase).
- `p_unit` luôn có. `p_warehouse`, `p_group`, `p_search` **có thể null** (không lọc); `p_search` là mẫu `ILIKE` đã có `%` hai đầu, tìm không dấu bằng `sys_search_match`.
- **Sổ kho là sổ chỉ ghi thêm**: phiếu bỏ ghi sổ để lại dòng đảo (`reversal_of_id`), nên tổng thẳng các dòng là đúng. Bảng kê nhập / xuất chỉ lấy dòng còn hiệu lực (không phải dòng đảo, chưa bị đảo). Nhập xuất tồn tính dòng đảo vào chiều của dòng gốc.
- Số lượng theo **đơn vị tính gốc** của vật tư, giá trị theo tiền hạch toán.
- Không tính quyền, che tiền, ngôn ngữ trong SQL (để lớp .NET làm).

Chạy thử: `psql ... -c "select * from rpt_stock_slow('DVCS01', current_date, 90, null, null, null)"`. Chạy script **hai lần** để chắc chắn chạy lại được.

---

## 3. Backend

### 3.1. File SQL một dòng gọi hàm

`ServerService/Core.Infrastructure/Modules/Inventory/Reports/Sql/StockSlow.sql` (tài nguyên nhúng, tự đưa vào chương trình theo mẫu `Modules\**\Sql\*.sql`):

```sql
-- Hàng chậm luân chuyển (hàm rpt_stock_slow).
SELECT * FROM rpt_stock_slow(@unit, @asof::date, @days, @warehouse::text, @materialGroup::text, @search::text);
```

Ép kiểu tham số (`@x::date`, `::text`) vì tham số null không có kiểu. Ngày truyền từ C# bằng `DateTime` (Dapper không nhận `DateOnly`).

### 3.2. Hợp đồng và quy tắc

`Core.Application/Modules/Inventory/Reports/StockReportContracts.cs` (hoặc file của module mới):

```csharp
/// <summary>Hàng chậm luân chuyển: tồn đến AsOf (mặc định hôm nay), không xuất trong Days ngày (mặc định 90).</summary>
public sealed record SlowStockQuery(DateOnly? AsOf = null, int? Days = null, string? Warehouse = null, string? Group = null, string? Search = null);

public sealed record SlowStockRowDto(string WarehouseCode, string? WarehouseName, string MaterialCode, string MaterialName,
    string UomCode, decimal Quantity, decimal? Value, DateOnly? LastOutDate);   // Value: null khi thiếu VIEW_COST
```

Thêm hai hàm vào `IStockReports` (`GetSlowAsync`, `ExportSlowAsync`). **Quy tắc không cần cơ sở dữ liệu** để ở `StockReportRules` (có test riêng), ví dụ kiểm số ngày:

```csharp
public static int SlowDays(int? days) => days is null ? 90 : days is >= 1 and <= 3650 ? days.Value : throw new BusinessRuleException("report.daysInvalid");
```

### 3.3. Service

`StockReportService` đã có sẵn các khối dùng chung; chỉ thêm lớp hàng đọc và hai hàm:

```csharp
private sealed class SlowRow            // tên thuộc tính = tên cột (PascalCase)
{
    public string WarehouseCode { get; set; } = ""; public string? WarehouseName { get; set; }
    public string MaterialCode { get; set; } = ""; public string MaterialName { get; set; } = ""; public string UomCode { get; set; } = "";
    public decimal Quantity { get; set; } public decimal Value { get; set; } public DateOnly? LastOutDate { get; set; }
}

public async Task<IReadOnlyList<SlowStockRowDto>> GetSlowAsync(string unitCode, SlowStockQuery query, bool canSeeCost, CancellationToken ct)
{
    var rows = Limited(await QueryAsync<SlowRow>("StockSlow", new
    {
        unit = unitCode, asof = Day(query.AsOf ?? Today), days = StockReportRules.SlowDays(query.Days),
        warehouse = Code(query.Warehouse), materialGroup = Code(query.Group), search = Pattern(query.Search)
    }, ct));
    return rows.Select(x => new SlowStockRowDto(x.WarehouseCode, x.WarehouseName, x.MaterialCode, x.MaterialName, x.UomCode,
        x.Quantity, canSeeCost ? x.Value : null, x.LastOutDate)).ToList();     // che tiền ở ĐÂY, không ở giao diện
}
```

Dùng nguyên các hàm dùng chung của lớp: `QueryAsync<T>` (thiếu hàm trong cơ sở dữ liệu thì báo `report.functionMissing` kèm tên script, không phải lỗi 500 mơ hồ), `Limited` (quá `MaxRows` thì `report.tooMany`), `Code` / `Pattern` / `Day`.

Xuất Excel: bộ cột + `FileAsync` (tạo file bằng `IExcelExporter`, **ghi nhật ký `Export`** rồi `SaveChangesAsync`):

```csharp
public async Task<ExportFile> ExportSlowAsync(int userId, string unitCode, SlowStockQuery query, bool canSeeCost, CancellationToken ct)
{
    var rows = await GetSlowAsync(unitCode, query, canSeeCost, ct);
    var columns = new List<ExportColumn<SlowStockRowDto>>
    {
        new(Header("warehouse"), x => x.WarehouseName ?? x.WarehouseCode), new(Header("materialCode"), x => x.MaterialCode),
        new(Header("materialName"), x => x.MaterialName), new(Header("uom"), x => x.UomCode), new(Header("quantity"), x => x.Quantity)
    };
    if (canSeeCost) columns.Add(new(Header("value"), x => x.Value));          // cột tiền chỉ có khi được xem
    columns.Add(new(Header("lastOutDate"), x => x.LastOutDate?.ToString("yyyy-MM-dd")));
    return await FileAsync(userId, "inv_report_slow", "export.report.sheet.slow", "HangChamLuanChuyen", columns, rows,
        $"asOf={query.AsOf}; days={query.Days}; warehouse={query.Warehouse}; group={query.Group}; search={query.Search}", ct);
}
```

### 3.4. Controller

Thêm hai endpoint vào `StockReportsController` (hoặc controller mới, kế thừa `ApiControllerBase`, `[Route("api/<phân-hệ>/reports")]`):

```csharp
private const string SlowFn = "inv_report_slow";

[HttpGet("slow"), RequirePermission(SlowFn, PermissionAction.View)]
public async Task<IReadOnlyList<SlowStockRowDto>> Slow([FromQuery] SlowStockQuery query, CancellationToken ct) =>
    await reports.GetSlowAsync(CurrentUnitCode, query, await CanSeeCostAsync(SlowFn, ct), ct);

[HttpGet("slow/export"), RequirePermission(SlowFn, PermissionAction.View), RequirePermission(SlowFn, PermissionAction.Export)]
public async Task<IActionResult> SlowExport([FromQuery] SlowStockQuery query, CancellationToken ct) =>
    Excel(await reports.ExportSlowAsync(CurrentUserId, CurrentUnitCode, query, await CanSeeCostAsync(SlowFn, ct), ct));
```

Quy tắc quyền của báo cáo: **xem = `View`; xuất = `View` và `Export`; tiền = quyền đặc biệt `VIEW_COST` của chính chức năng này** (`CanSeeCostAsync`); in chỉ là nút ở giao diện (`Print`).

### 3.5. Khai báo chức năng và quyền

| Việc | Ở đâu |
| --- | --- |
| Mã chức năng | `Core.Application/Common/Permissions/FunctionCatalog.cs`: `["inv_report_slow"] = "Báo cáo hàng chậm luân chuyển"` |
| **Quyền xem giá vốn / giá** (nếu báo cáo có tiền) | `SpecialRightCatalog.cs`: thêm mã vào mảng `PricedCatalogsAndReports`. Không thêm thì báo cáo **không có** quyền `VIEW_COST` để cấp và không ai ngoài quản trị viên thấy tiền |
| **Quyền dùng các ô chọn trên màn lọc** (kho, nhóm vật tư...) | `Core.Application/Common/Lookups/LookupAccess.cs`: thêm mã vào mảng `StockReports` (hoặc `Consumers` của tra cứu cụ thể). **Quên bước này thì ô chọn kho / nhóm vật tư của báo cáo trả 403 cho người chỉ có quyền xem báo cáo** |
| Thông báo và tiêu đề cột (vi + en) | `Messages.vi.json`, `Messages.en.json`: `export.report.sheet.slow`, `export.report.lastOutDate` (dùng lại `export.report.warehouse`, `materialCode`, `materialName`, `uom`, `quantity`, `value` đã có), `report.daysInvalid`; bản en thêm `function.inv_report_slow` |
| Menu | `Core/SeedData/menu.json`: nút trong nhóm báo cáo của phân hệ, `titleVi`, `titleEn`, `subKey` = mã chức năng. Backend tự thêm vào `sys_command` khi khởi động |

Dùng lại `StockReportService` thì DI đã có; nếu viết service mới thì đăng ký ở `Core.Infrastructure/DependencyInjection.cs`.

---

## 4. Frontend

### 4.1. Khai báo

| Việc | Ở đâu |
| --- | --- |
| Mã chức năng | `Frontend/src/types/index.ts` (`SubMenuKey`) |
| Đăng ký | `config/functions.ts`: `inv_report_slow: fn('inventory', '/inventory/report-slow', 'Báo cáo hàng chậm luân chuyển', 'report')`. Thiếu dòng này TypeScript báo lỗi |
| Tên menu và đường dẫn | `locales/vi/common.json` và `locales/en/common.json`: `navigation.subMenus.inv_report_slow`; bản en thêm `function.inv_report_slow` |
| Quyền mặc định cho tài khoản mẫu | `mock/initialRoles.ts` (nếu cần có sẵn trong dữ liệu mẫu) |
| Hiện màn | `case 'inv_report_slow'` trong `modules/inventory/InventoryModule.tsx` |

### 4.2. API

Thêm vào `modules/inventory/reports/api.ts`: kiểu hàng + hai hàm trong `stockReportsApi`:

```ts
export interface SlowRow { warehouseCode: string; warehouseName?: string | null; materialCode: string; materialName: string; uomCode: string;
  quantity: number; value: number | null; lastOutDate: string | null }

slow: (filters: ReportFilters) => apiRequest<SlowRow[]>('GET', `${url}/slow${reportQuery(filters)}`),
// exportFile: thêm 'slow' vào kiểu report và tên file { slow: 'HangChamLuanChuyen' }
```

### 4.3. Màn hình

Dùng khung `ReportKit.tsx`, **không viết lại bộ lọc, thẻ tổng, trạng thái tải / lỗi / rỗng, in, xuất**. Mẫu ngắn nhất: `AgingReportView.tsx` hoặc `MonthlyCostView.tsx`:

```tsx
export const SlowReportView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { formatQuantity, formatCurrency } = useNumberFormat();
  const [asOf, setAsOf] = useState(today());
  const [days, setDays] = useState('90');
  const [warehouse, setWarehouse] = useState(''); const [group, setGroup] = useState(''); const [searchText, setSearchText] = useState('');
  const search = useDebouncedSearch(searchText);
  const filters = { asOf, days, warehouse, materialGroup: group, search };
  const { data, loading, error, reload } = useReport(() => stockReportsApi.slow(filters), JSON.stringify(filters));
  const rows = data ?? [];
  const { visible, footer } = useRowLimit(rows);                       // 300 dòng đầu + nút "Xem thêm"
  const canSeeMoney = rows.length === 0 || rows.some(r => r.value !== null);

  return (
    <ReportFrame functionCode="inv_report_slow" currentUser={currentUser} icon={<Hourglass className="h-5 w-5" />}
      title={t('...')} count={rows.length} countLabel={t('...')} canSeeMoney={canSeeMoney}
      onRefresh={() => void reload()} onExport={() => stockReportsApi.exportFile('slow', filters)}
      filters={<>{/* ô ngày + số ngày */}<CommonFilters warehouse={warehouse} onWarehouse={setWarehouse} group={group} onGroup={setGroup} search={searchText} onSearch={setSearchText} /></>}
      loading={loading} error={error} empty={rows.length === 0} emptyTitle="..." ...>
      <table>{/* tiêu đề cột, visible.map(...), tiền dùng num(v, formatCurrency) → "—" khi null */}</table>
      {footer}
    </ReportFrame>
  );
};
```

Điểm cần nhớ:
- **Quyền hiển thị do khung lo**: nút Xuất chỉ hiện khi có `Export`, nút In khi có `Print` (`getActionPermission` bên trong `ReportFrame`); `canSeeMoney = false` thì khung hiện dòng giải thích vì sao thiếu cột tiền. Màn **không** tự kiểm quyền; backend mới là nơi chặn thật.
- Số lượng dùng `formatQuantity`, tiền `formatCurrency` (`useNumberFormat`); ô trống do `null` hiển thị bằng `num(value, format)`.
- Chữ trên màn: **dùng `t('...')`** với khóa ở `locales/{vi,en}/inventory.json` (các màn báo cáo Kho đang còn gõ cứng tiếng Việt, đó là việc nợ chứ không phải mẫu nên theo; xem [da-ngon-ngu.md](da-ngon-ngu.md) mục L2).
- Xuất Excel do **máy chủ** làm đúng theo bộ lọc hiện tại (`exportFile`), có tiêu đề theo ngôn ngữ và ghi nhật ký.
- Thêm `export { SlowReportView } from './SlowReportView'` vào `reports/index.ts`.

---

## 5. Kiểm tra

1. **Cơ sở dữ liệu**: chạy script hai lần; gọi hàm bằng `psql` với dữ liệu thật; so với cách tính tay.
2. **Test**: thêm test cho quy tắc vào `StockReportRulesTests` (khoảng ngày, giá trị mặc định, từ chối giá trị sai). Chạy `dotnet build Core.sln` (0 lỗi) và `dotnet test` (đủ test, kể cả `MessagesTests` kiểm đủ khóa vi / en, `LookupAccessTests`).
3. **API bằng tài khoản thật** (script trong thư mục tạm, dữ liệu thử dùng mã `ZZ*` và **ngày năm 2027** vì các tháng 2026 của DVCS01 đã khóa):
   - số liệu khớp tay; khớp với các báo cáo cùng chủ đề ở cùng một ngày;
   - bộ lọc kho, nhóm, từ khóa; khoảng ngày sai → 400 (`report.dateRange`);
   - **thiếu hàm** (chưa chạy script) → báo `report.functionMissing`, không phải 500;
   - **quyền**: không có quyền Xem → 403; chỉ Xem → xem được, `value` là `null`, Excel 403; có Xuất → Excel tải được; có `VIEW_COST` → có tiền; ô chọn kho / nhóm vật tư của màn lọc vẫn 200 với người chỉ có quyền xem báo cáo;
   - Excel: số dòng khớp bộ lọc, tiêu đề đúng ngôn ngữ, cột tiền biến mất khi thiếu quyền, có dòng nhật ký `EXPORT`.
4. **Trình duyệt**: mở màn, đổi bộ lọc, xuất, in, thử màn điện thoại (hẹp), thử tiếng Anh.
5. Quyền: cấp bằng SQL thì **khởi động lại backend** (bộ nhớ đệm quyền); cấp bằng màn Phân quyền thì có hiệu lực ngay.
6. **Dọn dữ liệu thử** (vật tư, phiếu, dòng sổ kho, dãy số `sys_voucher_sequence` của tháng thử, dòng nhật ký, quyền tạm); chạy `GET /api/inventory/stock/verify` phải rỗng.

Lỗi hay gặp:

| Dấu hiệu | Nguyên nhân |
| --- | --- |
| `report.functionMissing` | Chưa chạy script có hàm, hoặc chạy sai thứ tự (script đọc bảng chưa có) |
| Cột tiền luôn trống dù đã cấp quyền | Mã báo cáo chưa có trong `PricedCatalogsAndReports`; hoặc quyền cấp cho chức năng khác (quyền `VIEW_COST` **theo từng báo cáo**) |
| Ô chọn kho / nhóm trên màn lọc báo lỗi 403 | Chưa thêm mã báo cáo vào `StockReports` / `Consumers` của `LookupAccessCatalog` |
| Lỗi kiểu tham số null | Thiếu ép kiểu `@x::date`, `::text` trong file SQL |
| Dapper báo không nhận `DateOnly` | Truyền ngày bằng `DateTime` (hàm `Day`) |
| Báo cáo không khớp báo cáo khác cùng ngày | Quên tính dòng đảo của sổ kho, hoặc lọc đơn vị khác nhau |
| `MessagesTests` đỏ | Thiếu khóa en (`function.<mã>`, `export.report.*`) |

---

## 6. Tài liệu và triển khai

- Viết tài liệu người dùng và kỹ thuật trong `docs/<phân-hệ>/` (mẫu: [bao-cao-kho.md](../kho/bao-cao-kho.md): báo cáo nào trả lời câu hỏi gì, cách tính, quyền, màn hình, kiểm tra sau triển khai); sinh bản Word: `node docs/cong-cu/build-word.cjs <md> <docx> "<chân trang>" "<tiêu đề>"`; thêm một dòng vào `docs/README.md`.
- Cập nhật `CLAUDE.md` (đoạn báo cáo của phân hệ), `README.md` gốc, và bảng API trong `ServerService/README.md`.
- Hàm mới là **hàm**, không có bảng mới, nên từ điển cơ sở dữ liệu không đổi; nhưng nếu có thêm bảng thì chạy `node docs/cong-cu/gen-database-doc.cjs` (thêm mô tả bảng ở `docs/cong-cu/gen-database-doc.cjs` và cột ở `database-notes.cjs`, script ở `database-scripts.cjs`) rồi dựng lại Word.
- **Triển khai ở nơi khác**: chạy script SQL đúng thứ tự (sau script của bảng nó đọc); cấp cho vai trò quyền Xem / Xuất file, và `VIEW_COST` ở **Cài đặt › Người dùng & phân quyền** (chỉ quản trị viên có sẵn quyền).

## 7. Danh sách việc phải làm (tóm tắt)

- [ ] Chốt mã, đơn vị, bộ lọc, có tiền không, nguồn dữ liệu (mục 1)
- [ ] Hàm `rpt_*` (DROP + CREATE, tham số `p_*`, lọc đơn vị), chạy hai lần, thử bằng `psql`
- [ ] File SQL một dòng (`Sql/<Ten>.sql`) với ép kiểu tham số
- [ ] Query / DTO (tiền `decimal?`), quy tắc trong `StockReportRules` + test
- [ ] Service: `Get...Async` (che tiền theo `canSeeCost`), `Export...Async` (nhật ký `Export`); interface; DI
- [ ] Controller: View; export = View + Export; `CanSeeCostAsync`
- [ ] `FunctionCatalog`, **`PricedCatalogsAndReports`**, **`LookupAccessCatalog` (mảng `StockReports` hoặc `Consumers`)**, `Messages` vi + en (`export.report.*`, `report.*`, `function.<mã>`), `menu.json`
- [ ] Frontend: `SubMenuKey`, `functions.ts`, `navigation.subMenus` + `function.` (vi, en), `api.ts`, màn dùng `ReportKit`, `index.ts`, `case` trong module; chữ bằng `t()`
- [ ] Build, test, lint, `check-i18n`, `check-menu`; thử API với tài khoản không quyền / chỉ Xem / có Xuất / có `VIEW_COST`; thử trình duyệt; dọn dữ liệu thử
- [ ] Tài liệu (md + Word), `docs/README.md`, `CLAUDE.md`, `README.md`, `ServerService/README.md`; cấp quyền cho vai trò
