// Sinh tài liệu mô tả cơ sở dữ liệu (Markdown) từ database thật + chú thích trong thực thể C#.
// Dùng: node docs/cong-cu/gen-database-doc.cjs [tệp.md]   (mặc định docs/phat-trien/mo-ta-co-so-du-lieu.md)
// Cần psql (C:\Program Files\PostgreSQL\16\bin) và ServerService/Core/appsettings.Local.json (chuỗi kết nối; mật khẩu không bao giờ in ra).
// Sau đó: node docs/cong-cu/build-word.cjs <md> <docx> "<chân trang>" "<tiêu đề>"
const fs = require('node:fs');
const path = require('node:path');
const PER = require('./database-notes.cjs');
const SCRIPT_NOTES = require('./database-scripts.cjs');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const out = process.argv[2] || path.join(root, 'docs/phat-trien/mo-ta-co-so-du-lieu.md');
const conn = require(path.join(root, 'ServerService/Core/appsettings.Local.json')).ConnectionStrings.CoreContext;
const get = key => (new RegExp(`${key}=([^;]+)`, 'i').exec(conn) || [])[1];
const dbName = get('Database');
const env = { ...process.env, PGPASSWORD: get('Password'), PGCLIENTENCODING: 'UTF8' };
const psqlPath = ['C:/Program Files/PostgreSQL/16/bin/psql.exe', 'C:/Program Files/PostgreSQL/15/bin/psql.exe', 'psql'].find(p => p === 'psql' || fs.existsSync(p));
if (dbName !== 'erp_dev') { console.error('Chỉ chạy trên database erp_dev (đang là ' + dbName + ')'); process.exit(1); }
const query = sql => execFileSync(psqlPath, ['-h', get('Host') || 'localhost', '-U', get('Username') || 'postgres', '-d', dbName, '-At', '-F', '\t', '-c', sql],
  { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean).map(l => l.split('\t'));

// ---------------------------------------------------------------------------------------------------- dữ liệu từ database
const tables = query(`select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v') order by 1`);
const columns = query(`select c.relname, a.attnum, a.attname, format_type(a.atttypid,a.atttypmod), a.attnotnull, coalesce(pg_get_expr(d.adbin,d.adrelid),''), a.attidentity,
  coalesce((select true from pg_constraint k where k.conrelid=c.oid and k.contype='p' and a.attnum = any(k.conkey)),false)
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where n.nspname='public' and c.relkind in ('r','v') and a.attnum>0 and not a.attisdropped order by c.relname, a.attnum`);
const indexes = query(`select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by tablename, indexname`);
const constraints = query(`select conrelid::regclass::text, conname, contype, pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace and contype in ('c','u','f') order by 1,2`);
const triggers = query(`select tgrelid::regclass::text, tgname, pg_get_triggerdef(oid) from pg_trigger where not tgisinternal order by 1,2`);
const functions = query(`select proname, pg_get_function_arguments(oid), pg_get_function_result(oid) from pg_proc where pronamespace='public'::regnamespace order by 1`);
const refs = query(`select table_name, column_name, ref_table, ref_column, table_kind, blocks_delete, optional from sys_table_ref order by 1,2`);
const viewDef = query(`select pg_get_viewdef('sys_v_columns'::regclass)`).map(r => r.join('\t')).join('\n');

// ---------------------------------------------------------------------------------------------------- mô tả viết tay
const G = {
  sys_access: 'Người dùng và phân quyền', sys_config: 'Cài đặt hệ thống', sys_catalog: 'Danh mục hệ thống', sys_flow: 'Phê duyệt, thông báo, nhật ký',
  inv_catalog: 'Danh mục Kho', inv_doc: 'Chứng từ Kho', inv_ledger: 'Sổ kho và tồn kho', pur_catalog: 'Danh mục Mua hàng', pur_doc: 'Chứng từ Mua hàng', tech: 'Kỹ thuật (hạ tầng của khung)'
};
const T = {
  sys_users: [G.sys_access, 'Tài khoản người dùng. Khóa là `user_id`; `user_name` đăng nhập; `password_hash` là băm mật khẩu; `security_version` tăng khi khóa tài khoản hoặc đổi mật khẩu để vô hiệu hóa token cũ; `ma_dvcs` là đơn vị cơ sở mặc định. Nhiều cột `createtime/createid/...` là kiểu cũ (legacy).'],
  sys_role: [G.sys_access, 'Vai trò (nhóm quyền). `role_code` duy nhất; vai trò `ADMIN` có mọi quyền.'],
  sys_user_role: [G.sys_access, 'Gán vai trò cho người dùng.'],
  sys_command: [G.sys_access, 'Danh mục **chức năng và nút menu** (cây module → nhóm → chức năng). Mã chức năng (`menuid0`...) là khóa dùng chung cho menu, route, phân quyền, thông báo và phê duyệt; tự thêm khi backend khởi động từ `FunctionCatalog` và `menu.json`.'],
  sys_command_translation: [G.sys_access, 'Tên chức năng / menu theo từng ngôn ngữ.'],
  sys_role_command: [G.sys_access, 'Ma trận quyền của **vai trò** theo chức năng (xem, thêm, sửa, xóa, duyệt, in, xuất; vẫn lưu dạng 11 cờ cũ).'],
  sys_user_command: [G.sys_access, 'Quyền **ngoại lệ** của người dùng: mỗi dòng thay thế quyền của vai trò cho đúng một chức năng; hệ thống chỉ lưu phần chênh lệch.'],
  sys_role_right: [G.sys_access, 'Quyền đặc biệt của vai trò, dạng `{chức năng}:{MÃ}` (ví dụ `inv_receipt:VIEW_PRICE`); quyền trạng thái theo đơn vị có đuôi `@DVCS`.'],
  sys_user_right: [G.sys_access, 'Quyền đặc biệt của riêng người dùng: `is_granted` = true cấp thêm, false thu hồi so với vai trò.'],
  sys_user_company_unit: [G.sys_access, 'Các đơn vị cơ sở mà người dùng được làm việc (đổi đơn vị bằng `POST /api/auth/switch-unit`).'],
  sys_setting: [G.sys_config, 'Cấu hình dạng JSON theo mục (`section`) và đơn vị: mặc định, năm làm việc, hồ sơ doanh nghiệp, định dạng số, ẩn / hiện menu, thời hạn giữ nhật ký... Dùng cho giá trị mà bảng khác không tham chiếu tới.'],
  sys_fiscal_period: [G.sys_config, 'Khóa sổ theo **tháng và đơn vị cơ sở**: tháng đã khóa không lập, sửa, xóa chứng từ có ngày thuộc tháng đó.'],
  sys_voucher_numbering: [G.sys_config, 'Mẫu số chứng từ theo loại chứng từ và đơn vị (có `{DVCS}`, năm, tháng, số thứ tự).'],
  sys_voucher_sequence: [G.sys_config, 'Bộ đếm số chứng từ theo loại + đơn vị + kỳ (`period_key`); cấp số nguyên tử trong giao dịch lưu phiếu.'],
  sys_voucher_status: [G.sys_config, 'Tên trạng thái chứng từ đổi theo đơn vị và việc bật / tắt bước **Chờ duyệt**; chỉ lưu trạng thái đã đổi so với mặc định.'],
  sys_voucher_grid: [G.sys_config, 'Một dòng một lưới chi tiết của chứng từ (mỗi tab là một lưới, ví dụ PNK_ITEMS, PNK_BOM); giữ số cột gim cho cả hệ thống.'],
  sys_voucher_grid_column: [G.sys_config, 'Các cột của lưới chứng từ: thứ tự, tiêu đề, độ rộng, số lẻ, ẩn / hiện; kiểu và tra cứu vẫn do code quy định.'],
  sys_grid_layout: [G.sys_config, 'Bố cục lưới của từng người dùng (cột ẩn, thứ tự, độ rộng, sắp xếp, cỡ trang) và bố cục mặc định của công ty, theo chức năng + tên lưới.'],
  sys_login_notice: [G.sys_config, 'Thông báo hiện ở bảng bên trái màn đăng nhập (đang dùng, khoảng ngày, nội dung vi / en, ghim, loại nền).'],
  sys_login_image: [G.sys_config, 'Ảnh của thông báo đăng nhập (đã thu nhỏ, lưu dạng base64), đọc qua API mở `GET /api/auth/notice-images/{mã}`.'],
  sys_banner: [G.sys_config, 'Thanh thông báo hệ thống dưới header: mức INFO / WARNING / URGENT, khoảng giờ UTC, đơn vị áp dụng.'],
  sys_company_unit: [G.sys_catalog, 'Đơn vị cơ sở (DVCS): chi nhánh / công ty con mà chứng từ và kho thuộc về.'],
  sys_company_unit_translation: [G.sys_catalog, 'Tên đơn vị cơ sở theo ngôn ngữ.'],
  sys_department: [G.sys_catalog, 'Danh mục phòng ban; người dùng và quy tắc duyệt trỏ tới bằng `department_code`.'],
  sys_currency: [G.sys_catalog, 'Danh mục loại tiền; đúng một đồng tiền hạch toán (`is_base`).'],
  sys_exchange_rate: [G.sys_catalog, 'Tỷ giá theo loại tiền và ngày; mã danh mục dạng `USD@2026-10-08`.'],
  sys_tax_rate: [G.sys_catalog, 'Danh mục mã thuế (VAT, nhập khẩu, khác), thuế suất theo phần trăm, cờ miễn thuế. Cột trỏ tới là `tax_rate_code`.'],
  sys_language: [G.sys_catalog, 'Danh mục ngôn ngữ giao diện (mã chữ thường như `vi`, `en`); một dòng là mặc định.'],
  sys_approval_rule: [G.sys_flow, 'Quy tắc phê duyệt: chức năng, điều kiện (giá trị, phòng ban), các cấp duyệt và người duyệt.'],
  sys_document_approval: [G.sys_flow, 'Các cấp phê duyệt của từng chứng từ (khóa theo mã chức năng + số chứng từ): cấp, người duyệt hợp lệ, trạng thái, người và thời điểm xử lý, lý do.'],
  sys_notification: [G.sys_flow, 'Thông báo gửi cho người dùng (cá nhân hoặc toàn đơn vị), có liên kết mở thẳng chứng từ.'],
  sys_notification_read: [G.sys_flow, 'Người dùng nào đã đọc thông báo nào.'],
  sys_audit_log: [G.sys_flow, '**Nhật ký thay đổi** dùng chung mọi chức năng, tự ghi khi lưu (trường, giá trị trước → sau, người, đơn vị, địa chỉ IP); dọn tự động theo thời hạn giữ.'],
  sys_table_ref: [G.tech, 'Bản đồ tham chiếu giữa các bảng (không có khóa ngoại): mỗi cột `*_code` / `*_id` trỏ tới bảng nào, có chặn xóa không, có thể rỗng không. Ghi lại từ các thuộc tính `[References]` mỗi lần backend khởi động.'],
  sys_migration: [G.tech, 'Dấu các script SQL đã chạy (nếu dùng); không chứa dữ liệu nghiệp vụ.'],
  sys_v_columns: [G.tech, 'View: mọi cột của các bảng `erp_*` / `sys_*` ghép với bản đồ tham chiếu để thấy cột nào trỏ sang bảng nào.'],
  erp_uom: [G.inv_catalog, 'Đơn vị tính (cái, kg, thùng...).'],
  erp_uom_translation: [G.inv_catalog, 'Tên đơn vị tính theo ngôn ngữ.'],
  erp_uom_conversion: [G.inv_catalog, 'Quy đổi đơn vị tính (có thể riêng cho một vật tư): hệ số từ đơn vị này sang đơn vị kia.'],
  erp_material_group: [G.inv_catalog, 'Nhóm vật tư.'],
  erp_material_type: [G.inv_catalog, 'Loại vật tư, thuộc một nhóm.'],
  erp_material: [G.inv_catalog, 'Danh mục **vật tư / hàng hóa**: đơn vị tính gốc, loại, nhóm, các cờ `track_lot`, `has_expiry`, `track_location`, `is_stock_item`, phương pháp tính giá (AVERAGE / FIFO), tồn tối thiểu...'],
  erp_warehouse_type: [G.inv_catalog, 'Loại kho.'],
  erp_warehouse_type_translation: [G.inv_catalog, 'Tên loại kho theo ngôn ngữ.'],
  erp_warehouse: [G.inv_catalog, 'Danh mục kho.'],
  erp_warehouse_unit: [G.inv_catalog, 'Đơn vị cơ sở được dùng một kho (không có dòng = kho dùng chung mọi đơn vị).'],
  erp_location: [G.inv_catalog, 'Vị trí lưu kho (kệ, ô...) thuộc đúng một kho; mã duy nhất toàn hệ thống.'],
  erp_lot: [G.inv_catalog, 'Lô hàng của vật tư có theo dõi lô; khóa gộp vật tư + số lô, ngày hết hạn, trạng thái chặn.'],
  erp_supplier: [G.inv_catalog, 'Danh mục nhà cung cấp (mã số thuế, điện thoại, địa chỉ, nhóm).'],
  erp_goods_receipt: [G.inv_doc, 'Đầu **phiếu nhập kho** (ghi sổ tăng tồn): ngày, kho, loại nhập, nhà cung cấp, loại tiền, trạng thái, dự án, các số đơn mua đã lấy.'],
  erp_goods_receipt_line: [G.inv_doc, 'Dòng phiếu nhập kho: `kind` = ITEM (hàng nhập) hoặc MATERIAL (nguyên vật liệu); số lượng, giá, lô, vị trí, dòng đơn mua đã nhận.'],
  erp_goods_issue: [G.inv_doc, 'Đầu **phiếu xuất kho** (ghi sổ giảm tồn, tính giá bình quân): khách hàng, người nhận, dự án, các số phiếu yêu cầu đã lấy.'],
  erp_goods_issue_line: [G.inv_doc, 'Dòng phiếu xuất kho (ITEM / MATERIAL), dòng yêu cầu xuất kho đã thực hiện.'],
  erp_issue_request: [G.inv_doc, 'Đầu **phiếu yêu cầu xuất kho** (duyệt, không ghi sổ).'],
  erp_issue_request_line: [G.inv_doc, 'Dòng phiếu yêu cầu xuất kho.'],
  erp_stock_movement: [G.inv_ledger, '**Sổ kho**: nhật ký chỉ-thêm các lần nhập xuất (số lượng có dấu theo đơn vị tính gốc, giá trị theo tiền hạch toán). Bỏ ghi sổ ghi dòng đảo qua `reversal_of_id`; ghi sổ lại tăng `posting_seq`.'],
  erp_stock_balance: [G.inv_ledger, 'Tồn theo đơn vị + kho + vật tư (số lượng, giá trị); luôn bằng tổng sổ kho.'],
  erp_stock_lot_balance: [G.inv_ledger, 'Tồn theo thêm lô (chỉ vật tư theo dõi lô).'],
  erp_stock_location_balance: [G.inv_ledger, 'Tồn theo thêm vị trí (chỉ vật tư theo dõi vị trí).'],
  erp_project: [G.pur_catalog, 'Danh mục **dự án**: chiều theo dõi chi phí (và sau này doanh thu) trên chứng từ mua hàng và kho.'],
  erp_payment_term: [G.pur_catalog, 'Danh mục điều khoản thanh toán (số ngày công nợ).'],
  erp_supplier_group: [G.pur_catalog, 'Danh mục nhóm nhà cung cấp.'],
  erp_purchase_request: [G.pur_doc, 'Đầu **phiếu yêu cầu mua hàng** (duyệt, không ghi sổ).'],
  erp_purchase_request_line: [G.pur_doc, 'Dòng phiếu yêu cầu mua hàng.'],
  erp_purchase_order: [G.pur_doc, 'Đầu **đơn mua hàng** (duyệt, không ghi sổ): nhà cung cấp, điều khoản, thuế, ngày giao dự kiến, dự án.'],
  erp_purchase_order_line: [G.pur_doc, 'Dòng đơn mua hàng: dòng yêu cầu mua đã đặt, ngày dự kiến nhận của từng dòng.']
};
const COMMON = {
  id: 'Khóa chính, tự tăng', code: 'Mã (khóa nghiệp vụ, chữ hoa)', name: 'Tên hiển thị', note: 'Ghi chú', is_active: 'Đang sử dụng (false = ngừng dùng)', sort_order: 'Thứ tự sắp xếp mặc định',
  created_at: 'Thời điểm tạo (UTC), do hệ thống điền', created_by: 'Mã người dùng tạo, do hệ thống điền', updated_at: 'Thời điểm sửa gần nhất (UTC)', updated_by: 'Mã người dùng sửa gần nhất',
  createtime: 'Thời điểm tạo (kiểu cũ)', createid: 'Người tạo (kiểu cũ)', updatetime: 'Thời điểm sửa (kiểu cũ)', updateid: 'Người sửa (kiểu cũ)',
  unit_code: 'Đơn vị cơ sở (trỏ `sys_company_unit`)', warehouse_code: 'Kho (trỏ `erp_warehouse`)', material_code: 'Mã vật tư (trỏ `erp_material`)', material_name: 'Tên vật tư chép từ danh mục lúc lưu',
  uom_code: 'Đơn vị tính (trỏ `erp_uom`)', currency_code: 'Loại tiền (trỏ `sys_currency`)', exchange_rate: 'Tỷ giá so với tiền hạch toán tại ngày chứng từ', supplier_code: 'Nhà cung cấp (trỏ `erp_supplier`)',
  supplier_name: 'Tên nhà cung cấp chép lúc lưu', project_code: 'Dự án (trỏ `erp_project`), tùy chọn', department_code: 'Phòng ban (trỏ `sys_department`)', tax_rate_code: 'Mã thuế (trỏ `sys_tax_rate`)',
  document_date: 'Ngày chứng từ (quyết định kỳ khóa sổ và số phiếu)', created_date: 'Ngày lập chứng từ', status: 'Trạng thái', total_value: 'Tổng giá trị quy ra tiền hạch toán',
  approved_by_user_id: 'Người duyệt cuối (mã người dùng)', line_no: 'Số thứ tự dòng trong chứng từ', quantity: 'Số lượng', unit_price: 'Đơn giá (theo loại tiền của chứng từ)', amount: 'Thành tiền = số lượng × đơn giá',
  voucher_type: 'Loại nghiệp vụ của chứng từ', required_date: 'Ngày cần hàng', delivery_date: 'Ngày giao / nhận dự kiến', lot_number: 'Số lô', position: 'Vị trí lưu kho', language: 'Mã ngôn ngữ',
  user_id: 'Mã người dùng (trỏ `sys_users`)', role_id: 'Mã vai trò (trỏ `sys_role`)', menuid0: 'Mã chức năng', description: 'Mô tả', email: 'Email', phone: 'Điện thoại', address: 'Địa chỉ', tax_code: 'Mã số thuế (khác `tax_rate_code`)'
};
const GROUP_ORDER = [G.sys_access, G.sys_config, G.sys_catalog, G.sys_flow, G.inv_catalog, G.inv_doc, G.inv_ledger, G.pur_catalog, G.pur_doc, G.tech];

// ---------------------------------------------------------------------------------------------------- dựng tài liệu
const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const colsOf = {}; for (const c of columns) (colsOf[c[0]] ||= []).push(c);
const idxOf = {}; for (const i of indexes) (idxOf[i[0]] ||= []).push(i);
const conOf = {}; for (const c of constraints) (conOf[c[0].replace(/^public\./, '')] ||= []).push(c);
const trgOf = {}; for (const t of triggers) (trgOf[t[0].replace(/^public\./, '')] ||= []).push(t);
const refsFrom = {}, refsTo = {};
for (const r of refs) { (refsFrom[r[0]] ||= []).push(r); (refsTo[r[2]] ||= []).push(r); }
const tableNames = tables.map(t => t[0]);
const unknown = tableNames.filter(t => !T[t]);
if (unknown.length) console.warn('Bảng chưa có mô tả viết tay:', unknown.join(', '));
const shortType = t => t.replace('character varying', 'varchar').replace('timestamp with time zone', 'timestamptz').replace('timestamp without time zone', 'timestamp').replace('double precision', 'double');
const defaultText = (d, identity) => identity ? 'tự tăng' : d.replace(/::[a-z ]+(\[\])?/g, '').replace(/^'(.*)'$/, "'$1'");

const L = [];
const total = columns.length;
L.push('# Mô tả cơ sở dữ liệu S-ERP', '');
L.push(`Tài liệu này mô tả toàn bộ cơ sở dữ liệu PostgreSQL của S-ERP: **${tableNames.filter(t => t !== 'sys_v_columns').length} bảng**, 1 view, ${total} cột, ${indexes.length} chỉ mục. Kiểu dữ liệu, độ dài, ràng buộc, chỉ mục, trigger và tham chiếu được **sinh tự động từ database thật** (\`erp_dev\`) bằng \`docs/cong-cu/gen-database-doc.cjs\`; phần mô tả bảng và cột viết tay trong \`docs/cong-cu/database-notes.cjs\` và công cụ. Nhờ vậy khớp với cấu trúc đang chạy. Khi đổi cấu trúc: chạy script SQL, rồi chạy lại công cụ để sinh lại tài liệu.`, '');
L.push('## 1. Quy ước chung', '');
L.push('### 1.1. Đặt tên', '',
  '- Bảng `sys_*` là **bảng hệ thống** (người dùng, quyền, cài đặt, phê duyệt, nhật ký...); bảng `erp_*` là **bảng nghiệp vụ** (danh mục và chứng từ Kho, Mua hàng...).',
  '- Tên bảng và cột viết `snake_case`, chữ thường. Tên tiếng Việt hiển thị nằm ở giao diện (`locales/*`), **không** đặt vào tên cột.',
  '- Khóa và tên của một **danh mục** luôn là `code` và `name`. Cột trỏ sang danh mục khác đặt `<tên bảng đích bỏ erp_/sys_>_code` (`uom_code`, `warehouse_code`, `supplier_code`...); riêng đơn vị cơ sở là `unit_code` (tên cũ). Mã số thuế là `tax_code`, còn mã thuế suất là `tax_rate_code`.',
  '- Chứng từ có `id` (bigint tự tăng) làm khóa chính và `code` là **số chứng từ** duy nhất toàn hệ thống; dòng chứng từ nằm ở bảng `*_line` với `(mã đầu phiếu, line_no)` duy nhất.', '');
L.push('### 1.2. Không dùng khóa ngoại', '',
  'Dự án **không dùng ràng buộc khóa ngoại**. Các bảng liên kết bằng cột mã hoặc id **có chỉ mục** (chỉ mục bắt đầu bằng chính cột đó). Việc kiểm tra do dịch vụ backend làm: khi lưu kiểm mã tham chiếu có thật; khi xóa từ chối nếu còn bản ghi khác đang dùng. Quan hệ được khai trên thực thể bằng `[References<Bảng đích>]` và ghi vào bảng `sys_table_ref` mỗi lần backend khởi động (mục 4). Vì vậy **xóa trực tiếp bằng SQL có thể để lại dòng mồ côi**; luôn xóa qua API hoặc dọn cả bảng con.', '');
L.push('### 1.3. Các cột dùng chung', '',
  '| Cột | Kiểu | Ý nghĩa |', '|---|---|---|',
  '| `created_at`, `created_by`, `updated_at`, `updated_by` | timestamptz, integer | **Dấu bản ghi** của mọi bảng `erp_*` (và các bảng `sys_*` đã chuyển khung): thời điểm UTC và mã người dùng; do `CoreContext` điền khi lưu, không do code nghiệp vụ gán |',
  '| `createtime`, `createid`, `updatetime`, `updateid` | timestamp, varchar | Dấu bản ghi **kiểu cũ** của một số bảng `sys_*` chưa chuyển |',
  '| *(không có cột)* `Version` | xmin | **Chống ghi đè**: EF ánh xạ cột hệ thống `xmin` của PostgreSQL làm phiên bản; DTO trả `version`, lưu kèm `version`, lệch thì HTTP 409. Không cần cột trong bảng |',
  '| `is_active`, `sort_order` | boolean, integer | Danh mục: đang sử dụng / ngừng dùng và thứ tự hiển thị |',
  '| `status` | varchar(20) | Trạng thái chứng từ: `Draft` (lập chứng từ), `Pending` (chờ duyệt), `Approved` (đã duyệt), `Posted` (đã ghi sổ), `Cancelled` (hủy); có CHECK ở các bảng chứng từ |', '');
L.push('### 1.4. Tiền, số lượng, ngày', '',
  '- **Số lượng** `numeric(18,4)`; **đơn giá** `numeric(18,4)`; **thành tiền** và **tổng giá trị** `numeric(18,2)`; **tỷ giá** `numeric(18,6)`, có CHECK `> 0`.',
  '- `total_value` của chứng từ luôn là **tiền hạch toán** (đã nhân tỷ giá); đơn giá và thành tiền của dòng theo **loại tiền của chứng từ**. Đơn mua hàng lưu thêm `sub_total`, `tax_amount` theo loại tiền của đơn.',
  '- **Ngày chứng từ** `document_date` kiểu `date` (không múi giờ); **thời điểm** hệ thống (`*_at`) kiểu `timestamptz` lưu UTC. Ngày lập `created_date` là ngày hệ thống theo UTC.',
  '- Tên vật tư, tên nhà cung cấp, điều khoản thanh toán trên chứng từ là **chữ chép lúc lưu**, để chứng từ cũ không đổi khi danh mục đổi tên.', '');
L.push('### 1.5. Cách làm việc với cơ sở dữ liệu', '',
  '- Chạy **mọi script** trong `ServerService/sql/postgresql/` theo thứ tự tên file (`00-helpers.sql` trước); mỗi script chạy lại được và tự chuyển dữ liệu cũ. Không có EF migration.',
  '- Thao tác thêm, sửa, xóa dữ liệu nghiệp vụ đi qua EF Core; **báo cáo, tính toán, ghi sổ kho** dùng SQL thuần qua `ISqlExecutor` (tệp `Core.Infrastructure/Modules/<Module>/Sql/*.sql`, luôn tham số hóa `@tên`).',
  '- Ghi sổ kho chỉ qua `IStockLedger`, **không** viết SQL riêng vào bảng `erp_stock_*`.',
  '- Không chạy script trên database khác `erp_dev` khi phát triển trên máy này.', '');

L.push('## 2. Danh sách bảng', '');
L.push('| Nhóm | Bảng | Số cột | Mô tả ngắn |', '|---|---|---|---|');
for (const g of GROUP_ORDER) for (const t of tableNames.filter(n => T[n] && T[n][0] === g))
  L.push(`| ${g} | \`${t}\` | ${colsOf[t]?.length ?? 0} | ${esc(T[t][1].split('. ')[0].replace(/\.$/, ''))} |`);
for (const t of unknown) L.push(`| (chưa phân nhóm) | \`${t}\` | ${colsOf[t]?.length ?? 0} | |`);
L.push('');

L.push('## 3. Quan hệ giữa các nhóm bảng', '',
  '```',
  'sys_company_unit ──< sys_users (ma_dvcs) ──< sys_user_role >── sys_role ──< sys_role_command / sys_role_right',
  'sys_command (chức năng) ──< sys_role_command, sys_user_command, sys_approval_rule, sys_notification',
  '',
  'erp_material_group ──< erp_material_type ──< erp_material ──< (dòng chứng từ, tồn kho, lô, quy đổi)',
  'erp_uom ──< erp_uom_conversion, erp_material, dòng chứng từ',
  'erp_warehouse ──< erp_location, erp_warehouse_unit, chứng từ, tồn kho',
  'erp_supplier_group ──< erp_supplier ──< phiếu yêu cầu mua, đơn mua, phiếu nhập',
  'erp_project ──< 5 chứng từ (project_code)         sys_tax_rate, erp_payment_term ──< erp_purchase_order',
  '',
  'erp_purchase_request ─line─> erp_purchase_order ─line─> erp_goods_receipt ──ghi sổ──> erp_stock_movement ──> erp_stock_balance / lot_balance / location_balance',
  'erp_issue_request   ─line─> erp_goods_issue   ──ghi sổ──> erp_stock_movement',
  '```', '',
  '(Mũi tên `──<` là "một – nhiều"; `─line─>` là dòng chứng từ sau trỏ về dòng chứng từ trước bằng `*_line_id`.) Danh sách cột tham chiếu **đầy đủ** nằm ở mục 4.', '');

L.push('## 4. Bản đồ tham chiếu (`sys_table_ref`)', '',
  'Mỗi dòng: cột của một bảng trỏ tới khóa của bảng nào. **Chặn xóa** = có thì bảng đích không xóa được khi còn dòng dùng; **Tùy chọn** = cột được để rỗng.', '',
  '| Bảng | Cột | Trỏ tới | Chặn xóa | Tùy chọn |', '|---|---|---|---|---|');
for (const r of refs) L.push(`| \`${r[0]}\` | \`${r[1]}\` | \`${r[2]}.${r[3]}\` | ${r[5] === 't' ? 'có' : 'không'} | ${r[6] === 't' ? 'có' : ''} |`);
L.push('', `(Tổng ${refs.length} tham chiếu. Cột chứng từ trỏ dòng nguồn bằng id như \`purchase_request_line_id\`, \`purchase_order_line_id\`, \`issue_request_line_id\` không nằm trong bản đồ vì là id, không phải mã danh mục; chúng được mô tả ở từng bảng.)`, '');

L.push('## 5. Mô tả từng bảng', '');
let n = 0;
for (const g of GROUP_ORDER) {
  const inGroup = tableNames.filter(t => T[t] && T[t][0] === g);
  if (!inGroup.length) continue;
  L.push(`### 5.${++n}. ${g}`, '');
  let k = 0;
  for (const t of inGroup) {
    L.push(`#### 5.${n}.${++k}. \`${t}\``, '', T[t][1], '');
    L.push('| STT | Cột | Kiểu | Null | Mặc định | Khóa | Mô tả |', '|---|---|---|---|---|---|---|');
    for (const c of colsOf[t] || []) {
      const [, num, name, type, notnull, def, identity, pk] = c;
      const ref = (refsFrom[t] || []).find(r => r[1] === name);
      let desc = PER[`${t}.${name}`] || COMMON[name] || '';
      if (ref && !/trỏ/.test(desc)) desc = (desc ? desc + '. ' : '') + `Trỏ \`${ref[2]}\``;
      L.push(`| ${num} | \`${name}\` | ${esc(shortType(type))} | ${notnull === 't' ? 'không' : 'có'} | ${esc(defaultText(def, identity && identity !== ''))} | ${pk === 't' ? 'PK' : ''} | ${esc(desc)} |`);
    }
    L.push('');
    const idx = idxOf[t] || [];
    if (idx.length) {
      L.push('Chỉ mục:', '');
      for (const i of idx) L.push(`- \`${i[1]}\`: ${i[2].replace(/^CREATE (UNIQUE )?INDEX \S+ ON (public\.)?\S+ /, m => (/UNIQUE/.test(m) ? '**duy nhất** ' : '')).replace(/USING btree /, '')}`);
      L.push('');
    }
    const con = (conOf[t] || []).filter(c => c[2] !== 'f');
    if (con.length) { L.push('Ràng buộc:', ''); for (const c of con) L.push(`- \`${c[1]}\` (${c[2] === 'c' ? 'CHECK' : 'UNIQUE'}): ${c[3]}`); L.push(''); }
    const to = (refsTo[t] || []).map(r => `\`${r[0]}.${r[1]}\``);
    if (to.length) { L.push(`Được trỏ tới bởi: ${[...new Set(to)].join(', ')}.`, ''); }
    const trg = trgOf[t] || [];
    if (trg.length) { L.push('Trigger:', ''); for (const x of trg) L.push(`- \`${x[1]}\`: ${x[2].replace(/^CREATE (CONSTRAINT )?TRIGGER \S+ /, '')}`); L.push(''); }
  }
}

L.push('## 6. View, hàm và trigger', '');
L.push('### 6.1. View `sys_v_columns`', '', T.sys_v_columns[1], '', '```sql', viewDef.trim(), '```', '');
L.push('### 6.2. Hàm trợ giúp', '', '| Hàm | Tham số | Trả về |', '|---|---|---|');
for (const f of functions.filter(x => !/^unaccent/.test(x[0]))) L.push(`| \`${f[0]}\` | ${esc(f[1])} | ${esc(f[2])} |`);
L.push('', 'Các hàm `unaccent*` do extension PostgreSQL `unaccent` cung cấp (bắt buộc cài). Các hàm `sys_rename_*`, `sys_drop_foreign_keys` phục vụ script chuyển cấu trúc; `sys_search_match(văn bản, mẫu)` tìm **không dấu** (dùng cho ô tìm kiếm).', '');
L.push('### 6.3. Trigger', '', '| Bảng | Trigger | Việc |', '|---|---|---|');
for (const t of triggers) L.push(`| \`${t[0].replace(/^public\./, '')}\` | \`${t[1]}\` | ${esc(t[2].replace(/^CREATE (CONSTRAINT )?TRIGGER \S+ /, ''))} |`);
L.push('', 'Trigger xóa phiếu (`erp_voucher_delete_cleanup`, script `41`): khi xóa đầu phiếu nhập / xuất, xóa luôn các dòng; từ chối nếu phiếu còn đang ghi sổ; với phiếu đã bỏ ghi sổ thì xóa cả các dòng sổ kho (cộng dồn bằng 0) để bảng tồn luôn bằng sổ kho.', '');

L.push('## 7. Các script SQL', '', 'Chạy theo thứ tự tên file trong `ServerService/sql/postgresql/`:', '', '| Script | Nội dung |', '|---|---|');
const scripts = fs.readdirSync(path.join(root, 'ServerService/sql/postgresql')).filter(f => f.endsWith('.sql')).sort();
const missingScript = [];
for (const f of scripts) {
  const key = f.slice(0, 2);
  if (!SCRIPT_NOTES[key]) missingScript.push(f);
  L.push(`| \`${f}\` | ${esc(SCRIPT_NOTES[key] || '(chưa mô tả)')} |`);
}
if (missingScript.length) console.warn('Script chưa có mô tả trong database-scripts.cjs:', missingScript.join(', '));
L.push('', '## 8. Kiểm tra cấu trúc bằng test tự động', '',
  '| Test (`ServerService/tests/Core.Tests`) | Canh điều gì |', '|---|---|',
  '| `TablesAndColumnsFollowNamingConvention` | tên bảng `sys_` / `erp_`, `snake_case` |',
  '| `BusinessTablesHaveRecordStamps` | mọi bảng `erp_*` có 4 cột dấu bản ghi |',
  '| `VersionedRecordsUseXminAsConcurrencyToken` | bản ghi sửa trên form dùng `xmin` làm phiên bản |',
  '| `TableReferenceTests` | mọi cột `*_code` khai `[References]` hoặc `[NotReference]`, có chỉ mục, bảng đích có nhãn `table.<tên>` |',
  '| `AuditDeclarationTests` | mọi thực thể khai `[Audited]` hoặc `[NotAudited]` |',
  '| `ConcurrencyContractTests` | dịch vụ sửa có `Version` và `ExpectVersion` |', '',
  '## 9. Cách cập nhật tài liệu này', '',
  '1. Sửa cấu trúc bằng script SQL mới (hoặc script đang làm), chạy hai lần trên `erp_dev`.',
  '2. Thêm mô tả bảng mới vào bảng `T` trong `docs/cong-cu/gen-database-doc.cjs` (công cụ cảnh báo bảng chưa có mô tả) và mô tả các cột mới vào `docs/cong-cu/database-notes.cjs`.',
  '3. `node docs/cong-cu/gen-database-doc.cjs` rồi `node docs/cong-cu/build-word.cjs docs/phat-trien/mo-ta-co-so-du-lieu.md docs/phat-trien/Mo-ta-co-so-du-lieu.docx "S-ERP - Mô tả cơ sở dữ liệu" "Mô tả cơ sở dữ liệu S-ERP"`.', '');

fs.writeFileSync(out, L.join('\n'));
console.log(`Đã ghi ${out}: ${tableNames.length} bảng/view, ${total} cột, ${L.length} dòng.`);
