/**
 * Tạo một danh mục mới (master data) chạy thật trên backend từ một file mô tả JSON, theo đúng khung danh mục của dự án:
 * script SQL, thực thể, hợp đồng, dịch vụ (CatalogService), controller, màn hình (CatalogScreen), và chèn đủ các chỗ đăng ký
 * (chức năng, DbSet, DI, tra cứu, quyền tra cứu, thông báo vi / en, menu, SubMenuKey, functions.ts, chữ màn hình, case trong module).
 *
 *   npm run tao-danh-muc -- duong/dan/mo-ta.json          tạo
 *   npm run tao-danh-muc -- duong/dan/mo-ta.json --thu    chỉ in ra sẽ tạo / sửa gì, không ghi
 *   npm run tao-danh-muc -- --hoan-tac inv_brand_cat      trả lại các tệp như trước lần tạo đó (bản sao ở .tao-danh-muc/, không vào git)
 *   npm run tao-danh-muc -- --khung                       dựng lại bộ khung chép tay ở docs/phat-trien/mau-danh-muc/
 *
 * File mô tả và các trường: docs/phat-trien/them-danh-muc-nhanh.md. Mẫu: docs/phat-trien/mau-danh-muc/vi-du-thuong-hieu.json.
 * Các chỗ đăng ký có một dòng đánh dấu "[tao-danh-muc]": dòng mới được chèn ngay trên dòng đó (người làm tay cũng dán ở đó).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------------------------------------------------------- kiểu
type Kieu = 'chu' | 'ghichu' | 'so' | 'nguyen' | 'logic' | 'ngay' | 'ma';

interface Truong {
  /** Tên cột snake_case, ví dụ "note", "material_group_code". */
  cot: string;
  kieu: Kieu;
  nhan: string;
  nhanEn: string;
  doDai?: number;
  batBuoc?: boolean;
  khongTrung?: boolean;
  soLe?: number;
  viDu?: string | number | boolean;
  /** Chỉ cho kiểu "ma": danh mục đích. */
  tro?: { lop: string; bang: string; traCuu: string };
}

interface MoTa {
  ma: string;
  phanHe: 'inventory' | 'purchasing' | 'sales' | 'production' | 'finance';
  ten: string;
  tenSoNhieu?: string;
  bang?: string;
  duongDan?: string;
  tenVi: string;
  tenEn: string;
  danhTu: string;
  danhTuEn: string;
  nhanMa: string;
  nhanMaEn: string;
  nhanTen: string;
  nhanTenEn: string;
  doDaiMa?: number;
  doDaiTen?: number;
  tenKhongTrung?: boolean;
  icon?: string;
  nhomMenu?: string;
  doiMa?: boolean;
  tenFile?: string;
  viDuMa?: string;
  viDuTen?: string;
  truong?: Truong[];
}

/** Every name the templates use. In --khung mode they are {{placeholders}} a person replaces by hand. */
interface Ten {
  ma: string; phanHe: string; PhanHe: string; Ten: string; Tens: string; ten: string; tens: string; kebab: string; bang: string;
  duongDan: string; tenVi: string; tenEn: string; danhTu: string; danhTuEn: string; DanhTu: string; nhanMa: string; nhanMaEn: string;
  nhanTen: string; nhanTenEn: string; doDaiMa: string; doDaiTen: string; tenFile: string; icon: string; viDuMa: string; viDuTen: string;
  maMenu: string;
}

// ------------------------------------------------------------------------------------------------------------- đường dẫn
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const P = (...parts: string[]) => join(root, ...parts);
const SQL_DIR = P('ServerService', 'sql', 'postgresql');
const KHUNG_DIR = P('docs', 'phat-trien', 'mau-danh-muc');
const MARK = '[tao-danh-muc]';

const MODULES: Record<MoTa['phanHe'], { Pascal: string; menuGroup: string; locale: string; moduleFile: string }> = {
  inventory: { Pascal: 'Inventory', menuGroup: 'GRP_INV_CAT', locale: 'inventory', moduleFile: 'inventory/InventoryModule.tsx' },
  purchasing: { Pascal: 'Purchasing', menuGroup: 'GRP_PUR_CATALOGS', locale: 'purchasing', moduleFile: 'purchasing/PurchasingModule.tsx' },
  sales: { Pascal: 'Sales', menuGroup: 'GRP_SALES_CAT', locale: 'sales', moduleFile: 'sales/SalesModule.tsx' },
  production: { Pascal: 'Production', menuGroup: 'GRP_PROD_CATALOGS', locale: 'production', moduleFile: 'production/ProductionModule.tsx' },
  finance: { Pascal: 'Finance', menuGroup: 'GRP_FIN_CAT', locale: 'common', moduleFile: 'finance/FinanceModule.tsx' }
};

// ------------------------------------------------------------------------------------------------------------- tiện ích
const fail = (message: string): never => { console.error(`LỖI: ${message}`); process.exit(1); };
const pascal = (snake: string) => snake.split('_').map(p => p[0].toUpperCase() + p.slice(1)).join('');
const camel = (s: string) => s[0].toLowerCase() + s.slice(1);
const kebabOf = (Pascal: string) => Pascal.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const snakeOf = (Pascal: string) => Pascal.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const noAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const fileNameOf = (vi: string) => noAccent(vi).split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
const cs = (s: string) => JSON.stringify(s); // a C# / TS string literal (same escaping for what we write)
const lower1 = (s: string) => s[0].toLowerCase() + s.slice(1);
const upper1 = (s: string) => s[0].toUpperCase() + s.slice(1);

interface Change { file: string; what: string; apply: () => void }
const changes: Change[] = [];
const created: string[] = [];

/** Line ending of a file (most files of the repo are CRLF in the working copy). */
const eolOf = (text: string) => (text.includes('\r\n') ? '\r\n' : '\n');

function newFile(path: string, content: string) {
  if (existsSync(path)) fail(`tệp đã có: ${relative(root, path)}`);
  changes.push({ file: path, what: 'tạo mới', apply: () => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content.replace(/\n/g, '\r\n')); } });
  created.push(path);
}

/** Inserts lines just above the marker line of the file (the marker of a module file: the one whose text contains `which`). */
function insertAtMarker(path: string, lines: string[], which?: string) {
  const text = readFileSync(path, 'utf8');
  const eol = eolOf(text);
  const all = text.split(/\r?\n/);
  const index = all.findIndex(l => l.includes(MARK) && (!which || l.includes(which)));
  if (index < 0) fail(`không thấy dòng đánh dấu ${MARK}${which ? ` (${which})` : ''} trong ${relative(root, path)}`);
  const indent = (all[index].match(/^\s*/) ?? [''])[0];
  changes.push({
    file: path, what: `chèn ${lines.length} dòng`, apply: () => {
      const fresh = readFileSync(path, 'utf8').split(/\r?\n/);
      const at = fresh.findIndex(l => l.includes(MARK) && (!which || l.includes(which)));
      fresh.splice(at, 0, ...lines.map(l => (l ? indent + l : l)));
      writeFileSync(path, fresh.join(eol));
    }
  });
}

/** Adds keys at the end of a flat message file (Messages.*.json), keeping its layout. */
function appendMessages(path: string, entries: Record<string, string>) {
  const text = readFileSync(path, 'utf8');
  const existing = JSON.parse(text) as Record<string, string>;
  for (const key of Object.keys(entries)) if (key in existing) fail(`khóa ${key} đã có trong ${relative(root, path)}`);
  changes.push({
    file: path, what: `thêm ${Object.keys(entries).length} khóa`, apply: () => {
      const fresh = readFileSync(path, 'utf8');
      const eol = eolOf(fresh);
      const end = fresh.lastIndexOf('}');
      const body = fresh.slice(0, end).replace(/\s+$/, '');
      const added = Object.entries(entries).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',' + eol);
      writeFileSync(path, `${body},${eol}${added}${eol}}${fresh.slice(end + 1)}`);
    }
  });
}

/** Edits a JSON file that round-trips through JSON.stringify(…, 2) (locales, menu.json). */
function editJson(path: string, what: string, edit: (json: any) => void) {
  const text = readFileSync(path, 'utf8');
  const json = JSON.parse(text);
  edit(json); // validate now (throws on a clash)
  changes.push({
    file: path, what, apply: () => {
      const fresh = readFileSync(path, 'utf8');
      const value = JSON.parse(fresh);
      edit(value);
      const eol = eolOf(fresh);
      const out = JSON.stringify(value, null, 2).replace(/\n/g, eol) + (/\r?\n$/.test(fresh) ? eol : '');
      writeFileSync(path, out);
    }
  });
}

// --------------------------------------------------------------------------------------------------------- kiểm mô tả
function load(path: string): MoTa {
  const spec = JSON.parse(readFileSync(resolve(path), 'utf8')) as MoTa;
  const need: (keyof MoTa)[] = ['ma', 'phanHe', 'ten', 'tenVi', 'tenEn', 'danhTu', 'danhTuEn', 'nhanMa', 'nhanMaEn', 'nhanTen', 'nhanTenEn'];
  for (const key of need) if (!spec[key]) fail(`thiếu "${key}" trong file mô tả`);
  if (!/^[a-z]+(_[a-z0-9]+)*_cat$/.test(spec.ma)) fail(`"ma" phải là chữ thường, nối bằng "_", kết thúc bằng "_cat" (ví dụ inv_brand_cat): ${spec.ma}`);
  if (!MODULES[spec.phanHe]) fail(`"phanHe" phải là một trong: ${Object.keys(MODULES).join(', ')}`);
  if (!/^[A-Z][A-Za-z0-9]*$/.test(spec.ten)) fail(`"ten" là tên lớp C# PascalCase, số ít (ví dụ Brand): ${spec.ten}`);
  for (const f of spec.truong ?? []) {
    if (!/^[a-z][a-z0-9_]*$/.test(f.cot)) fail(`cột "${f.cot}" phải là snake_case`);
    if (['code', 'name', 'is_active', 'sort_order', 'created_at', 'created_by', 'updated_at', 'updated_by'].includes(f.cot)) fail(`cột "${f.cot}" khung đã có sẵn`);
    if (!['chu', 'ghichu', 'so', 'nguyen', 'logic', 'ngay', 'ma'].includes(f.kieu)) fail(`cột ${f.cot}: kiểu "${f.kieu}" không có (chu, ghichu, so, nguyen, logic, ngay, ma)`);
    if (!f.nhan || !f.nhanEn) fail(`cột ${f.cot}: thiếu "nhan" / "nhanEn"`);
    if (f.kieu === 'ma') {
      if (!f.tro?.lop || !f.tro.bang || !f.tro.traCuu) fail(`cột ${f.cot}: kiểu "ma" cần "tro": { "lop", "bang", "traCuu" }`);
      const target = f.tro!.bang.replace(/^(erp|sys)_/, '');
      if (!f.cot.endsWith(`${target}_code`)) fail(`cột ${f.cot}: cột trỏ sang ${f.tro!.bang} phải kết thúc bằng "${target}_code" (quy ước tham chiếu)`);
    }
    if (f.cot.endsWith('_code') && f.kieu !== 'ma') fail(`cột ${f.cot}: cột tên *_code phải là kiểu "ma" (có "tro")`);
  }
  return spec;
}

function namesOf(spec: MoTa): Ten {
  const Tens = spec.tenSoNhieu ?? `${spec.ten}s`;
  const m = MODULES[spec.phanHe];
  const kebab = spec.duongDan ?? kebabOf(Tens);
  return {
    ma: spec.ma, phanHe: spec.phanHe, PhanHe: m.Pascal, Ten: spec.ten, Tens, ten: camel(spec.ten), tens: camel(Tens), kebab,
    bang: spec.bang ?? `erp_${snakeOf(spec.ten)}`, duongDan: `api/${spec.phanHe}/${kebab}`, tenVi: spec.tenVi, tenEn: spec.tenEn,
    danhTu: spec.danhTu, danhTuEn: spec.danhTuEn, DanhTu: upper1(spec.danhTu), nhanMa: spec.nhanMa, nhanMaEn: spec.nhanMaEn,
    nhanTen: spec.nhanTen, nhanTenEn: spec.nhanTenEn, doDaiMa: String(spec.doDaiMa ?? 20), doDaiTen: String(spec.doDaiTen ?? 200),
    tenFile: spec.tenFile ?? fileNameOf(spec.tenVi), icon: spec.icon ?? 'Tag', viDuMa: spec.viDuMa ?? 'MA01', viDuTen: spec.viDuTen ?? '',
    maMenu: `MNU_${spec.ma.toUpperCase()}`
  };
}

/** The names as placeholders, for the hand-copy kit. */
const KHUNG: Ten = {
  ma: '{{ma}}', phanHe: '{{phanHe}}', PhanHe: '{{PhanHe}}', Ten: '{{Ten}}', Tens: '{{Tens}}', ten: '{{ten}}', tens: '{{tens}}', kebab: '{{kebab}}',
  bang: '{{bang}}', duongDan: 'api/{{phanHe}}/{{kebab}}', tenVi: '{{tenVi}}', tenEn: '{{tenEn}}', danhTu: '{{danhTu}}', danhTuEn: '{{danhTuEn}}',
  DanhTu: '{{DanhTu}}', nhanMa: '{{nhanMa}}', nhanMaEn: '{{nhanMaEn}}', nhanTen: '{{nhanTen}}', nhanTenEn: '{{nhanTenEn}}', doDaiMa: '20',
  doDaiTen: '200', tenFile: '{{tenFile}}', icon: '{{Icon}}', viDuMa: 'MA01', viDuTen: '', maMenu: 'MNU_{{MA_IN_HOA}}'
};

// ------------------------------------------------------------------------------------------------------- từng trường
interface Field extends Truong { Prop: string; prop: string; n: number }
const fieldsOf = (spec: Pick<MoTa, 'truong'>): Field[] => (spec.truong ?? []).map(f => ({
  ...f, Prop: pascal(f.cot), prop: camel(pascal(f.cot)), n: f.doDai ?? (f.kieu === 'ghichu' ? 300 : f.kieu === 'ma' ? 20 : 100)
}));

const sqlType = (f: Field) => ({
  chu: `varchar(${f.n})${f.batBuoc ? ' NOT NULL' : ''}`, ghichu: `varchar(${f.n})${f.batBuoc ? ' NOT NULL' : ''}`,
  so: `numeric(18,${f.soLe ?? 2}) NOT NULL DEFAULT 0`, nguyen: 'integer NOT NULL DEFAULT 0', logic: 'boolean NOT NULL DEFAULT false',
  ngay: `date${f.batBuoc ? ' NOT NULL' : ''}`, ma: `varchar(${f.n})${f.batBuoc ? ' NOT NULL' : ''}`
}[f.kieu]);
const csType = (f: Field, forRequest = false) => ({
  chu: f.batBuoc && !forRequest ? 'string' : 'string?', ghichu: f.batBuoc && !forRequest ? 'string' : 'string?', ma: f.batBuoc && !forRequest ? 'string' : 'string?',
  so: 'decimal', nguyen: 'int', logic: 'bool', ngay: 'DateOnly?'
}[f.kieu]);
const csDefault = (f: Field) => ({ chu: 'null', ghichu: 'null', ma: 'null', so: '0', nguyen: '0', logic: 'false', ngay: 'null' }[f.kieu]);
const tsRecordType = (f: Field) => ({ chu: 'string | null', ghichu: 'string | null', ma: 'string | null', so: 'number', nguyen: 'number', logic: 'boolean', ngay: 'string | null' }[f.kieu]);
const tsInputType = (f: Field) => ({ chu: 'string', ghichu: 'string', ma: 'string', so: 'number', nguyen: 'number', logic: 'boolean', ngay: 'string | null' }[f.kieu]);
const tsEmpty = (f: Field) => ({ chu: "''", ghichu: "''", ma: "''", so: '0', nguyen: '0', logic: 'false', ngay: 'null' }[f.kieu]);
const sortable = (f: Field) => ['chu', 'so', 'nguyen', 'ngay', 'ma'].includes(f.kieu);
const searchable = (f: Field) => ['chu', 'ghichu', 'ma'].includes(f.kieu);

// ------------------------------------------------------------------------------------------------------------ mẫu tệp
function sqlFile(t: Ten, fields: Field[], tenKhongTrung: boolean, number: string) {
  const cols = fields.map(f => `    ${f.cot} ${sqlType(f)},`).join('\n');
  const idx = [
    tenKhongTrung ? `CREATE UNIQUE INDEX IF NOT EXISTS ux_${t.bang}_name ON ${t.bang} (lower(name));` : '',
    ...fields.filter(f => f.kieu === 'chu' && f.khongTrung).map(f => `CREATE UNIQUE INDEX IF NOT EXISTS ux_${t.bang}_${f.cot} ON ${t.bang} (lower(${f.cot})) WHERE ${f.cot} IS NOT NULL;`),
    ...fields.filter(f => f.kieu === 'ma').map(f => `-- Xóa ${f.tro!.bang} tra cột này (chặn xóa mã đang dùng).\nCREATE INDEX IF NOT EXISTS ix_${t.bang}_${f.cot} ON ${t.bang} (${f.cot});`)
  ].filter(Boolean).join('\n');
  return `-- ${t.tenVi} (${t.bang}), chức năng ${t.ma}. Sinh bằng "npm run tao-danh-muc" (script ${number}); không khóa ngoại, chạy lại được.
CREATE TABLE IF NOT EXISTS ${t.bang} (
    code varchar(${t.doDaiMa}) PRIMARY KEY,
    name varchar(${t.doDaiTen}) NOT NULL,
${cols ? cols + '\n' : ''}    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by integer,
    updated_at timestamptz,
    updated_by integer
);
${idx}
`;
}

function entityFile(t: Ten, fields: Field[], targetNamespaces: string[]) {
  const usings = ['System.ComponentModel.DataAnnotations', 'System.ComponentModel.DataAnnotations.Schema', 'Core.Domain.Common',
    ...targetNamespaces.filter(ns => ns !== `Core.Domain.Modules.${t.PhanHe}`)];
  const props = fields.map(f => {
    const ref = f.kieu === 'ma' ? `    [References<${f.tro!.lop}>${f.batBuoc ? '' : '(Optional = true)'}]\n` : '';
    const attrs = [
      (f.batBuoc && ['chu', 'ghichu', 'ma'].includes(f.kieu)) ? 'Required' : '',
      f.kieu === 'so' ? `Column("${f.cot}", TypeName = "numeric(18,${f.soLe ?? 2})")` : `Column("${f.cot}")`,
      ['chu', 'ghichu', 'ma'].includes(f.kieu) ? `MaxLength(${f.n})` : ''
    ].filter(Boolean).join(', ');
    const init = csType(f) === 'string' ? ' = string.Empty;' : '';
    return `${ref}    [${attrs}] public ${csType(f)} ${f.Prop} { get; set; }${init}`;
  }).join('\n');
  return `${usings.map(u => `using ${u};`).join('\n')}

namespace Core.Domain.Modules.${t.PhanHe};

/// <summary>${t.tenVi} (${t.ma}): danh mục trên khung CatalogService.</summary>
[Audited("${t.ma}", "${t.ten}", Label = "{Code} - {Name}")]
[Table("${t.bang}")]
public class ${t.Ten} : ErpEntity, ICatalogRecord
{
    [Key, Column("code"), MaxLength(${t.doDaiMa})] public string Code { get; set; } = string.Empty;
    [Required, Column("name"), MaxLength(${t.doDaiTen})] public string Name { get; set; } = string.Empty;
${props ? props + '\n' : ''}    [Column("is_active")] public bool IsActive { get; set; } = true;
    [Column("sort_order")] public int SortOrder { get; set; }
}
`;
}

function contractsFile(t: Ten, fields: Field[]) {
  const dto = ['string Code', 'string Name', ...fields.map(f => `${csType(f)} ${f.Prop}`), 'bool IsActive', 'RecordStampDto Stamp', 'uint Version'].join(', ');
  const req = ['string Code', 'string Name', ...fields.map(f => `${csType(f, true)} ${f.Prop} = ${csDefault(f)}`), 'bool IsActive = true', 'uint? Version = null'].join(', ');
  return `using Core.Application.Common.Catalogs;
using Core.Application.Common.Persistence;

namespace Core.Application.Modules.${t.PhanHe}.Categories;

/// <summary>${t.tenVi} (${t.ma}).</summary>
public sealed record ${t.Ten}Dto(${dto});

public sealed record Save${t.Ten}Request(${req}) : ICatalogRequest;

public interface I${t.Ten}Service : ICatalogService<${t.Ten}Dto, Save${t.Ten}Request>;
`;
}

function serviceFile(t: Ten, fields: Field[], tenKhongTrung: boolean, doiMa: boolean) {
  const sorts = fields.filter(sortable).map(f => `.Add("${f.prop}", x => x.${f.Prop})`).join('');
  const search = ['x.Code', 'x.Name', ...fields.filter(searchable).map(f => `x.${f.Prop}`)].map(x => `SearchFunctions.Matches(${x}, pattern)`).join(' || ');
  const exportCols = [
    `new("export.${t.ten}.code", x => x.Code)`, `new("export.${t.ten}.name", x => x.Name)`,
    ...fields.map(f => `new("export.${t.ten}.${f.prop}", x => ${f.kieu === 'logic' ? `YesNo(x.${f.Prop})` : f.kieu === 'ngay' ? `x.${f.Prop}?.ToString("yyyy-MM-dd")` : `x.${f.Prop}`})`),
    `new("export.${t.ten}.isActive", x => YesNo(x.IsActive))`
  ].join(',\n        ');
  const dtoArgs = ['x.Code', 'x.Name', ...fields.map(f => `x.${f.Prop}`), 'x.IsActive', 'stamp(x)', 'x.Version'].join(', ');
  const apply = fields.map(f => {
    const label = `"field.${t.ten}${f.Prop}"`;
    switch (f.kieu) {
      case 'chu': case 'ghichu': {
        const read = f.batBuoc ? `Guard.Required(request.${f.Prop}, ${f.n}, ${label})` : `Guard.Optional(request.${f.Prop}, ${f.n}, ${label})`;
        if (!(f.kieu === 'chu' && f.khongTrung)) return `        row.${f.Prop} = ${read};`;
        return `        var ${f.prop} = ${read};
        if (${f.prop} is not null && await Db.${t.Tens}.AnyAsync(x => x.Code != row.Code && x.${f.Prop} != null && x.${f.Prop}.ToLower() == ${f.prop}.ToLower(), ct))
            throw new BusinessRuleException("${t.ten}.${f.prop}Exists", ${f.prop});
        row.${f.Prop} = ${f.prop};`;
      }
      case 'ma':
        return f.batBuoc ? `        row.${f.Prop} = Guard.Code(request.${f.Prop}, ${f.n}, ${label});`
          : `        row.${f.Prop} = string.IsNullOrWhiteSpace(request.${f.Prop}) ? null : Guard.Code(request.${f.Prop}, ${f.n}, ${label});`;
      case 'ngay':
        return f.batBuoc ? `        row.${f.Prop} = request.${f.Prop} ?? throw new BusinessRuleException("validation.required", new Text(${label}));`
          : `        row.${f.Prop} = request.${f.Prop};`;
      default:
        return `        row.${f.Prop} = request.${f.Prop};`;
    }
  }).join('\n');
  const needsText = fields.some(f => f.kieu === 'ngay' && f.batBuoc);
  return `using Core.Application.Common.Auditing;
using Core.Application.Common.Catalogs;
using Core.Application.Common.Exceptions;
using Core.Application.Common.Export;
${needsText ? 'using Core.Application.Common.Localization;\n' : ''}using Core.Application.Common.Persistence;
using Core.Application.Common.Validation;
using Core.Application.Modules.${t.PhanHe}.Categories;
using Core.Domain.Common;
using Core.Domain.Modules.${t.PhanHe};
using Core.Infrastructure.Common.Catalogs;
using Core.Infrastructure.Common.Paging;
using Core.Infrastructure.Common.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Core.Infrastructure.Modules.${t.PhanHe}.Categories;

/// <summary>${t.tenVi} (${t.ma}) on the shared CatalogService. Rules special to this catalog go in ApplyAsync.</summary>
public sealed class ${t.Ten}Service(CoreContext db, CatalogBatch batch, IExcelExporter excel, IAuditLog audit)
    : CatalogService<${t.Ten}, ${t.Ten}Dto, Save${t.Ten}Request>(db, batch, excel, audit), I${t.Ten}Service
{
    private static readonly CatalogSpec Info = new("${t.ma}", "${t.ten}", "field.${t.ten}Code", ${t.doDaiMa}, "${t.tenFile}"${doiMa ? ', CodeChange: true' : ''});

    private static readonly SortMap<${t.Ten}> SortColumns = SortMap<${t.Ten}>.By(x => x.Code, "order")
        .Add("order", x => x.SortOrder).Add("code", x => x.Code).Add("name", x => x.Name)${sorts}.Add("isActive", x => x.IsActive).AddRecordStamps();

    protected override CatalogSpec Spec => Info;
    protected override SortMap<${t.Ten}> Sorts => SortColumns;

    protected override IQueryable<${t.Ten}> Search(IQueryable<${t.Ten}> rows, string pattern) =>
        rows.Where(x => ${search});

    protected override IReadOnlyList<ExportColumn<${t.Ten}>> ExportColumns() =>
    [
        ${exportCols}
    ];

    protected override Save${t.Ten}Request WithoutVersion(Save${t.Ten}Request request) => request with { Version = null };

    protected override Task<IReadOnlyList<${t.Ten}Dto>> MapAsync(IReadOnlyList<${t.Ten}> rows, Func<ErpEntity, RecordStampDto> stamp, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<${t.Ten}Dto>>(rows.Select(x => new ${t.Ten}Dto(${dtoArgs})).ToList());

    protected override async Task ApplyAsync(${t.Ten} row, Save${t.Ten}Request request, CancellationToken ct)
    {
        var name = Guard.Required(request.Name, ${t.doDaiTen}, "field.${t.ten}Name");
${tenKhongTrung ? `        if (await Db.${t.Tens}.AnyAsync(x => x.Code != row.Code && x.Name.ToLower() == name.ToLower(), ct))
            throw new BusinessRuleException("${t.ten}.nameExists", name);
` : ''}        row.Name = name;
${apply ? apply + '\n' : ''}        row.IsActive = request.IsActive;
    }
}
`;
}

function controllerFile(t: Ten) {
  return `using Core.Application.Modules.${t.PhanHe}.Categories;
using Core.Application.Modules.Users;
using Core.Common.Authorization;
using Core.Common.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Core.Modules.${t.PhanHe}.Categories;

/// <summary>${t.tenVi} (lookup <c>${t.tens}</c>). The seven catalog endpoints and their rights come from CatalogControllerBase.</summary>
[Route("${t.duongDan}")]
[CatalogFunction("${t.ma}")]
public sealed class ${t.Tens}Controller(I${t.Ten}Service service, IPermissionService permissions)
    : CatalogControllerBase<${t.Ten}Dto, Save${t.Ten}Request>(service, permissions);
`;
}

function apiFile(t: Ten, fields: Field[]) {
  const rec = fields.map(f => `  ${f.prop}${f.kieu === 'so' || f.kieu === 'nguyen' || f.kieu === 'logic' ? '' : '?'}: ${tsRecordType(f)};`).join('\n');
  const inp = fields.map(f => `  ${f.prop}: ${tsInputType(f)};`).join('\n');
  return `// ${t.tenVi} (${t.ma}), backend /${t.duongDan}. The list is paged on the server.
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { RecordStamp } from '../../../../components/common/RecordStamp';

export interface ${t.Ten}Record {
  code: string;
  name: string;
${rec ? rec + '\n' : ''}  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface Save${t.Ten}Input {
  code: string;
  name: string;
${inp ? inp + '\n' : ''}  isActive: boolean;
  version?: number;
}

export const ${t.tens}Api = createCatalogApi<${t.Ten}Record, Save${t.Ten}Input>({
  url: '/${t.duongDan}', fileName: '${t.tenFile}'
});
`;
}

function viewFile(t: Ten, fields: Field[], doiMa: boolean) {
  const g = t.tens;
  const has = (k: Kieu) => fields.some(f => f.kieu === k);
  const columns = fields.map(f => {
    const base = `{ key: '${f.prop}', header: t('${g}.${f.prop}')${sortable(f) ? ', sortable: true' : ''}`;
    switch (f.kieu) {
      case 'logic': return `${base}, align: 'center', render: row => (row.${f.prop} ? '✓' : '') }`;
      case 'so': case 'nguyen': return `${base}, align: 'right', render: row => formatNumber(row.${f.prop}) }`;
      case 'ngay': return `${base}, render: row => row.${f.prop}?.slice(0, 10) || '—' }`;
      case 'ma': return `${base}, render: row => row.${f.prop} ? <span className="font-mono">{row.${f.prop}}</span> : '—' }`;
      default: return `${base}, render: row => row.${f.prop} || '—' }`;
    }
  });
  const excel = fields.map(f => {
    const type = f.kieu === 'logic' ? `, type: 'boolean'` : (f.kieu === 'so' || f.kieu === 'nguyen') ? `, type: 'number'` : '';
    const example = f.viDu !== undefined ? JSON.stringify(f.viDu) : (f.kieu === 'logic' ? 'false' : (f.kieu === 'so' || f.kieu === 'nguyen') ? '0' : "''");
    return `{ key: '${f.prop}', header: t('${g}.${f.prop}')${f.batBuoc ? ', required: true' : ''}${type}, width: 20, example: ${example} }`;
  });
  const toInput = fields.map(f => {
    switch (f.kieu) {
      case 'chu': case 'ghichu': case 'ma': return `${f.prop}: row.${f.prop} ?? ''`;
      case 'ngay': return `${f.prop}: row.${f.prop}?.slice(0, 10) ?? null`;
      default: return `${f.prop}: row.${f.prop}`;
    }
  });
  const normalize = fields.map(f => {
    switch (f.kieu) {
      case 'chu': case 'ghichu': return `${f.prop}: input.${f.prop}.trim()`;
      case 'ma': return `${f.prop}: input.${f.prop}.trim().toUpperCase()`;
      case 'ngay': return `${f.prop}: input.${f.prop} || null`;
      default: return '';
    }
  }).filter(Boolean);
  const form = fields.map(f => {
    const label = `t('${g}.${f.prop}')`;
    const req = f.batBuoc ? ' required' : '';
    switch (f.kieu) {
      case 'chu': return `<TextInput label={${label}}${req} maxLength={${f.n}} value={form.${f.prop}} onChange={e => setForm({ ...form, ${f.prop}: e.target.value })} />`;
      case 'ghichu': return `<TextArea label={${label}}${req} rows={2} maxLength={${f.n}} value={form.${f.prop}} onChange={e => setForm({ ...form, ${f.prop}: e.target.value })} />`;
      case 'so': case 'nguyen': return `<FormField label={${label}}${req}>
          {id => <NumberInput id={id} value={form.${f.prop}} decimals={${f.kieu === 'so' ? (f.soLe ?? 2) : 0}} onChange={${f.prop} => setForm({ ...form, ${f.prop} })} />}
        </FormField>`;
      case 'logic': return `<Checkbox label={${label}} checked={form.${f.prop}} onChange={${f.prop} => setForm({ ...form, ${f.prop} })} />`;
      case 'ngay': return `<TextInput label={${label}}${req} type="date" value={form.${f.prop} ?? ''} onChange={e => setForm({ ...form, ${f.prop}: e.target.value || null })} />`;
      case 'ma': return `<CatalogLookup lookup="${f.tro!.traCuu}" label={${label}}${req} value={form.${f.prop}} onChange={code => setForm({ ...form, ${f.prop}: code })} />`;
    }
  });
  const searchText = ['row.code', 'row.name', ...fields.filter(searchable).map(f => `row.${f.prop} ?? ''`)].map(x => `\${${x}}`).join(' ');
  const empty = ["code: ''", "name: ''", ...fields.map(f => `${f.prop}: ${tsEmpty(f)}`), 'isActive: true'].join(', ');
  const fieldInputs = ['code: row.code', 'name: row.name', ...toInput, 'isActive: row.isActive'].join(', ');
  const imports = [
    `import React, { useMemo } from 'react';`,
    `import { ${t.icon} } from 'lucide-react';`,
    `import { Badge } from '../../../../components/common/Badge';`,
    `import { Checkbox } from '../../../../components/common/Checkbox';`,
    `import { ${[has('so') || has('nguyen') ? 'FormField' : '', has('ghichu') ? 'TextArea' : '', 'TextInput'].filter(Boolean).join(', ')} } from '../../../../components/common/FormField';`,
    has('so') || has('nguyen') ? `import { NumberInput } from '../../../../components/common/NumberInput';` : '',
    `import { recordStampColumns } from '../../../../components/common/recordStampColumns';`,
    has('ma') ? `import { CatalogLookup } from '../../../../components/catalog/CatalogLookup';` : '',
    `import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';`,
    `import type { CatalogDefinition } from '../../../../components/catalog/catalogTypes';`,
    `import { useLanguage } from '../../../../context/LanguageContext';`,
    has('so') || has('nguyen') ? `import { useNumberFormat } from '../../../../context/NumberFormatContext';` : '',
    `import type { UserProfile } from '../../../../types';`,
    `import { ${t.tens}Api, type ${t.Ten}Record, type Save${t.Ten}Input } from './api';`
  ].filter(Boolean).join('\n');
  return `// ${t.tenVi} (${t.ma}) on the shared catalog screen: the screen only declares columns, form and Excel columns.
${imports}

export const ${t.Ten}CategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
${has('so') || has('nguyen') ? '  const { formatNumber } = useNumberFormat();\n' : ''}  const toInput = (row: ${t.Ten}Record): Save${t.Ten}Input => ({ ${fieldInputs} });
  const definition = useMemo((): CatalogDefinition<${t.Ten}Record, Save${t.Ten}Input> => ({
    functionCode: '${t.ma}',${doiMa ? ` codeChange: { lookup: '${t.tens}' },` : ''} api: ${t.tens}Api,
    keyOf: row => row.code, describe: row => \`\${row.code} - \${row.name}\`,
    icon: <${t.icon} className="h-4 w-4" />,
    texts: {
      title: t('${g}.title'), subtitle: t('${g}.subtitle'), noun: t('${g}.noun'),
      add: t('${g}.add'), searchPlaceholder: t('${g}.search'),
      addTitle: t('${g}.addTitle'), editTitle: row => t('${g}.editTitle', { code: row.code }),
      fileName: '${t.tenFile}'
    },
    columns: [
      { key: 'code', header: t('${g}.code'), width: '140px', sortable: true, render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('${g}.name'), sortable: true },
${columns.map(c => `      ${c},`).join('\n')}${columns.length ? '\n' : ''}      { key: 'isActive', header: t('${g}.status'), align: 'center', width: '130px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('${g}.inUse')}</Badge>
          : <Badge variant="slate" size="sm">{t('${g}.notInUse')}</Badge> },
      ...recordStampColumns<${t.Ten}Record>(t)
    ],
    searchText: row => \`${searchText}\`,
    excel: {
      columns: [
        { key: 'code', header: t('${g}.code'), required: true, width: 16, example: '${t.viDuMa}' },
        { key: 'name', header: t('${g}.name'), required: true, width: 30, example: ${JSON.stringify(t.viDuTen)} },
${excel.map(c => `        ${c},`).join('\n')}${excel.length ? '\n' : ''}        { key: 'isActive', header: t('${g}.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: toInput
    },
    emptyInput: { ${empty} },
    toInput,
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim()${normalize.map(n => `, ${n}`).join('')} }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <TextInput label={t('${g}.code')} required autoFocus={!editing} disabled={!!editing} maxLength={${t.doDaiMa}} className="font-mono uppercase"
          value={form.code} hint={t('${g}.codeHint')} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\\s/g, '') })} />
        <TextInput label={t('${g}.name')} required autoFocus={!!editing} maxLength={${t.doDaiTen}} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
${form.map(c => `        ${c}`).join('\n')}${form.length ? '\n' : ''}        <Checkbox label={t('${g}.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
      </>
    ),
    formWidth: 'lg'
  }), [t${has('so') || has('nguyen') ? ', formatNumber' : ''}]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
`;
}

const indexFile = (t: Ten) => `export { ${t.Ten}CategoryView } from './${t.Ten}CategoryView';\nexport { ${t.tens}Api } from './api';\nexport type { ${t.Ten}Record, Save${t.Ten}Input } from './api';\n`;

// ------------------------------------------------------------------------------------------------------- chữ và thông báo
function messagesOf(t: Ten, fields: Field[], spec: { tenKhongTrung: boolean }) {
  const vi: Record<string, string> = {
    [`field.${t.ten}Code`]: lower1(t.nhanMa), [`field.${t.ten}Name`]: lower1(t.nhanTen),
    [`${t.ten}.notFound`]: `${t.DanhTu} không tồn tại.`, [`${t.ten}.codeExists`]: `${t.nhanMa} {0} đã tồn tại.`,
    [`table.${t.bang}`]: t.DanhTu,
    [`export.${t.ten}.sheet`]: t.tenVi, [`export.${t.ten}.code`]: t.nhanMa, [`export.${t.ten}.name`]: t.nhanTen
  };
  const en: Record<string, string> = {
    [`field.${t.ten}Code`]: lower1(t.nhanMaEn), [`field.${t.ten}Name`]: lower1(t.nhanTenEn),
    [`${t.ten}.notFound`]: `The ${t.danhTuEn} does not exist.`, [`${t.ten}.codeExists`]: `${t.nhanMaEn} {0} already exists.`,
    [`table.${t.bang}`]: upper1(t.tenEn),
    [`export.${t.ten}.sheet`]: t.tenEn, [`export.${t.ten}.code`]: t.nhanMaEn, [`export.${t.ten}.name`]: t.nhanTenEn,
    [`function.${t.ma}`]: t.tenEn
  };
  if (spec.tenKhongTrung) {
    vi[`${t.ten}.nameExists`] = `${t.nhanTen} "{0}" đã tồn tại.`;
    en[`${t.ten}.nameExists`] = `${t.nhanTenEn} "{0}" already exists.`;
  }
  for (const f of fields) {
    vi[`export.${t.ten}.${f.prop}`] = f.nhan; en[`export.${t.ten}.${f.prop}`] = f.nhanEn;
    if (['chu', 'ghichu', 'ma', 'ngay'].includes(f.kieu)) { vi[`field.${t.ten}${f.Prop}`] = lower1(f.nhan); en[`field.${t.ten}${f.Prop}`] = lower1(f.nhanEn); }
    if (f.kieu === 'chu' && f.khongTrung) { vi[`${t.ten}.${f.prop}Exists`] = `${f.nhan} "{0}" đã tồn tại.`; en[`${t.ten}.${f.prop}Exists`] = `${f.nhanEn} "{0}" already exists.`; }
  }
  vi[`export.${t.ten}.isActive`] = 'Đang sử dụng'; en[`export.${t.ten}.isActive`] = 'In use';
  return { vi, en };
}

function screenTexts(t: Ten, fields: Field[], lang: 'vi' | 'en') {
  const vi = lang === 'vi';
  const out: Record<string, string> = {
    title: vi ? t.tenVi : t.tenEn,
    subtitle: vi ? `Khai báo ${t.danhTu} dùng trong hệ thống.` : `The ${t.danhTuEn} list used across the system.`,
    noun: vi ? t.danhTu : t.danhTuEn,
    add: vi ? `Thêm ${t.danhTu}` : `Add ${t.danhTuEn}`,
    search: vi ? 'Tìm theo mã, tên...' : 'Search by code, name...',
    addTitle: vi ? `Thêm ${t.danhTu}` : `Add ${t.danhTuEn}`,
    editTitle: vi ? `Sửa ${t.danhTu} {code}` : `Edit ${t.danhTuEn} {code}`,
    code: vi ? t.nhanMa : t.nhanMaEn,
    codeHint: vi ? 'Không đổi được sau khi tạo' : 'Cannot be changed after creation',
    name: vi ? t.nhanTen : t.nhanTenEn
  };
  for (const f of fields) out[f.prop] = vi ? f.nhan : f.nhanEn;
  Object.assign(out, vi
    ? { status: 'Trạng thái', isActive: 'Đang sử dụng', inUse: 'Còn sử dụng', notInUse: 'Ngừng sử dụng' }
    : { status: 'Status', isActive: 'In use', inUse: 'In use', notInUse: 'Not in use' });
  return out;
}

// ------------------------------------------------------------------------------------------------------------- chạy
function nextSqlNumber() {
  const numbers = readdirSync(SQL_DIR).map(f => /^(\d+)-/.exec(f)?.[1]).filter(Boolean).map(Number);
  return String(Math.max(...numbers) + 1).padStart(2, '0');
}

/** Namespace of an existing domain class (for [References<T>]). */
function namespaceOfDomainClass(name: string): string {
  const stack = [P('ServerService', 'Core.Domain')];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { if (!['bin', 'obj'].includes(entry.name)) stack.push(full); continue; }
      if (!entry.name.endsWith('.cs')) continue;
      const text = readFileSync(full, 'utf8');
      if (new RegExp(`\\bclass ${name}\\b`).test(text)) return /namespace ([\w.]+)/.exec(text)![1];
    }
  }
  return fail(`không thấy lớp ${name} trong Core.Domain (kiểu "ma": "tro.lop" phải là thực thể có sẵn)`);
}

function ensureFree(spec: MoTa, t: Ten) {
  const read = (...p: string[]) => readFileSync(P(...p), 'utf8');
  if (read('ServerService', 'Core.Application', 'Common', 'Permissions', 'FunctionCatalog.cs').includes(`["${t.ma}"]`)) fail(`mã chức năng ${t.ma} đã có`);
  if (read('ServerService', 'Core.Infrastructure', 'Common', 'Persistence', 'CoreContext.cs').match(new RegExp(`\\bDbSet<[\\w.]*\\b${t.Ten}>`))) fail(`thực thể ${t.Ten} đã có DbSet`);
  if (read('ServerService', 'Core.Infrastructure', 'Common', 'Lookups', 'LookupCatalogs.cs').includes(`"${t.tens}"`)) fail(`tra cứu ${t.tens} đã có`);
  if (read('ServerService', 'Core.Application', 'Common', 'Lookups', 'LookupAccess.cs').includes(`"${t.tens}"`)) fail(`quyền tra cứu ${t.tens} đã có`);
  for (const f of readdirSync(SQL_DIR)) if (readFileSync(join(SQL_DIR, f), 'utf8').includes(`CREATE TABLE IF NOT EXISTS ${t.bang} (`)) fail(`bảng ${t.bang} đã có trong ${f}`);
  const icons = read('Frontend', 'src', 'components', 'common', 'DynamicIcon.tsx');
  if (!new RegExp(`\\b${t.icon}\\b`).test(icons)) fail(`icon ${t.icon} chưa có trong components/common/DynamicIcon.tsx (chọn icon có sẵn hoặc thêm vào đó trước)`);
  void spec;
}

function plan(spec: MoTa) {
  const t = namesOf(spec);
  const fields = fieldsOf(spec);
  const m = MODULES[spec.phanHe];
  const tenKhongTrung = spec.tenKhongTrung !== false;
  const doiMa = !!spec.doiMa;
  ensureFree(spec, t);
  const targets = [...new Set(fields.filter(f => f.kieu === 'ma').map(f => namespaceOfDomainClass(f.tro!.lop)))];

  // 9 new files
  const number = nextSqlNumber();
  newFile(join(SQL_DIR, `${number}-${spec.phanHe}-${t.kebab}.sql`), sqlFile(t, fields, tenKhongTrung, number));
  newFile(P('ServerService', 'Core.Domain', 'Modules', m.Pascal, 'Categories', `${t.Ten}.cs`), entityFile(t, fields, targets));
  newFile(P('ServerService', 'Core.Application', 'Modules', m.Pascal, 'Categories', `${t.Ten}Contracts.cs`), contractsFile(t, fields));
  newFile(P('ServerService', 'Core.Infrastructure', 'Modules', m.Pascal, 'Categories', `${t.Ten}Service.cs`), serviceFile(t, fields, tenKhongTrung, doiMa));
  newFile(P('ServerService', 'Core', 'Modules', m.Pascal, 'Categories', `${t.Tens}Controller.cs`), controllerFile(t));
  const feature = P('Frontend', 'src', 'modules', spec.phanHe, 'categories', t.kebab);
  newFile(join(feature, 'api.ts'), apiFile(t, fields));
  newFile(join(feature, `${t.Ten}CategoryView.tsx`), viewFile(t, fields, doiMa));
  newFile(join(feature, 'index.ts'), indexFile(t));

  // 11 registrations
  insertAtMarker(P('ServerService', 'Core.Application', 'Common', 'Permissions', 'FunctionCatalog.cs'), [`[${cs(t.ma)}] = ${cs(t.tenVi)},`]);
  insertAtMarker(P('ServerService', 'Core.Infrastructure', 'Common', 'Persistence', 'CoreContext.cs'),
    [`public DbSet<Core.Domain.Modules.${t.PhanHe}.${t.Ten}> ${t.Tens} => Set<Core.Domain.Modules.${t.PhanHe}.${t.Ten}>();`]);
  insertAtMarker(P('ServerService', 'Core.Infrastructure', 'DependencyInjection.cs'),
    [`services.AddScoped<Core.Application.Modules.${t.PhanHe}.Categories.I${t.Ten}Service, Core.Infrastructure.Modules.${t.PhanHe}.Categories.${t.Ten}Service>();`]);
  insertAtMarker(P('ServerService', 'Core.Infrastructure', 'Common', 'Lookups', 'LookupCatalogs.cs'), [
    `new LookupDefinition(${cs(t.tens)}, db => db.${t.Tens}.Select(x =>`,
    `    new LookupRow { Code = x.Code, Name = x.Name, IsActive = x.IsActive }), [${cs(t.bang)}]),`]);
  insertAtMarker(P('ServerService', 'Core.Application', 'Common', 'Lookups', 'LookupAccess.cs'),
    [`Rule(${cs(t.tens)}, ${cs(t.ma)}), // ${t.tenVi}: thêm các màn chọn mã từ danh mục này vào tham số thứ ba, ví dụ ["inv_receipt"]`]);
  if (doiMa) insertAtMarker(P('ServerService', 'Core.Application', 'Common', 'Permissions', 'SpecialRightCatalog.cs'), [`${cs(t.ma)},`]);
  const msg = messagesOf(t, fields, { tenKhongTrung });
  appendMessages(P('ServerService', 'Core.Application', 'Common', 'Localization', 'Messages.vi.json'), msg.vi);
  appendMessages(P('ServerService', 'Core.Application', 'Common', 'Localization', 'Messages.en.json'), msg.en);
  editJson(P('ServerService', 'Core', 'SeedData', 'menu.json'), `thêm nút menu ${t.maMenu}`, menu => {
    const group = (menu as any[]).flatMap(mod => mod.subGroups ?? []).find((g: any) => g.id === (spec.nhomMenu ?? m.menuGroup));
    if (!group) fail(`không thấy nhóm menu ${spec.nhomMenu ?? m.menuGroup} trong menu.json`);
    if ((menu as any[]).flatMap(mod => (mod.subGroups ?? []).flatMap((g: any) => g.items ?? [])).some((i: any) => i.subKey === t.ma || i.id === t.maMenu)) fail(`menu đã có ${t.ma}`);
    const order = Math.max(0, ...(group.items ?? []).map((i: any) => i.orderNo ?? 0)) + 10;
    (group.items ??= []).push({ id: t.maMenu, subKey: t.ma, titleVi: t.tenVi, titleEn: t.tenEn, icon: t.icon, orderNo: order, isActive: true });
  });
  insertAtMarker(P('Frontend', 'src', 'types', 'index.ts'), [`| '${t.ma}'${' '.repeat(Math.max(1, 26 - t.ma.length))}// ${t.tenVi}`]);
  insertAtMarker(P('Frontend', 'src', 'config', 'functions.ts'), [`${t.ma}: fn('${spec.phanHe}', '/${spec.phanHe}/${t.kebab}', ${cs(t.tenVi).replace(/^"|"$/g, "'")}, 'catalog'),`]);
  for (const lang of ['vi', 'en'] as const) {
    editJson(P('Frontend', 'src', 'locales', lang, 'common.json'), 'thêm audit.objectType' + (lang === 'en' ? ' và function' : ''), json => {
      json.audit ??= {}; json.audit.objectType ??= {};
      if (json.audit.objectType[t.ten]) fail(`audit.objectType.${t.ten} đã có (${lang})`);
      json.audit.objectType[t.ten] = lang === 'vi' ? t.DanhTu : upper1(t.danhTuEn);
      if (lang === 'en') { json.function ??= {}; json.function[t.ma] = t.tenEn; }
    });
    editJson(P('Frontend', 'src', 'locales', lang, `${m.locale}.json`), `thêm nhóm chữ "${t.tens}"`, json => {
      if (json[t.tens]) fail(`nhóm chữ "${t.tens}" đã có trong locales/${lang}/${m.locale}.json`);
      json[t.tens] = screenTexts(t, fields, lang);
    });
  }
  const moduleFile = P('Frontend', 'src', 'modules', m.moduleFile);
  insertAtMarker(moduleFile, [`import { ${t.Ten}CategoryView } from './categories/${t.kebab}/${t.Ten}CategoryView';`], 'Import');
  insertAtMarker(moduleFile, [`case '${t.ma}':`, `  return <${t.Ten}CategoryView currentUser={currentUser} />;`], 'case');
  return t;
}

/** The hand-copy kit: the same templates with {{placeholders}} and one example "note" field. */
function writeKit() {
  const fields = fieldsOf({ truong: [{ cot: 'note', kieu: 'ghichu', nhan: 'Ghi chú', nhanEn: 'Note', doDai: 300 }] });
  const t = KHUNG;
  const files: [string, string][] = [
    ['1-NN-phan-he-ten.sql', sqlFile(t, fields, true, 'NN')],
    ['2-{{Ten}}.cs', entityFile(t, fields, [])],
    ['3-{{Ten}}Contracts.cs', contractsFile(t, fields)],
    ['4-{{Ten}}Service.cs', serviceFile(t, fields, true, false)],
    ['5-{{Tens}}Controller.cs', controllerFile(t)],
    ['6-api.ts', apiFile(t, fields)],
    ['7-{{Ten}}CategoryView.tsx', viewFile(t, fields, false)],
    ['8-index.ts', indexFile(t)]
  ];
  mkdirSync(KHUNG_DIR, { recursive: true });
  for (const [name, content] of files) writeFileSync(join(KHUNG_DIR, name), content.replace(/\n/g, '\r\n'));
  const msg = messagesOf(t, fields, { tenKhongTrung: true });
  const texts = { vi: screenTexts(t, fields, 'vi'), en: screenTexts(t, fields, 'en') };
  writeFileSync(join(KHUNG_DIR, '9-chu-va-thong-bao.json'), JSON.stringify({
    _huongDan: 'Messages.vi.json / Messages.en.json: thêm các khóa của "messagesVi" / "messagesEn" vào cuối file. locales/<vi|en>/<phân hệ>.json: thêm nhóm "{{tens}}" bằng "screenVi" / "screenEn". locales/<vi|en>/common.json: audit.objectType.{{ten}}; bản en thêm function.{{ma}}.',
    messagesVi: msg.vi, messagesEn: msg.en, screenVi: texts.vi, screenEn: texts.en
  }, null, 2).replace(/\n/g, '\r\n') + '\r\n');
  console.log(`Đã dựng bộ khung ở ${relative(root, KHUNG_DIR)} (${files.length + 1} tệp).`);
}

// ---------------------------------------------------------------------------------------------------------- hoàn tác
/** Copies of the files a run changes and the list of the files it creates, so "--hoan-tac <mã>" puts everything back. */
const UNDO_DIR = P('.tao-danh-muc');

function saveUndo(ma: string) {
  const dir = join(UNDO_DIR, ma);
  if (existsSync(dir)) fail(`đã có bản hoàn tác của ${ma} (${relative(root, dir)}): chạy --hoan-tac ${ma} hoặc xóa thư mục đó trước`);
  const changed = [...new Set(changes.filter(c => !created.includes(c.file)).map(c => c.file))];
  for (const file of changed) {
    const copy = join(dir, 'ban-cu', relative(root, file));
    mkdirSync(dirname(copy), { recursive: true });
    writeFileSync(copy, readFileSync(file));
  }
  writeFileSync(join(dir, 'tep-moi.json'), JSON.stringify({ created: created.map(f => relative(root, f)), changed: changed.map(f => relative(root, f)) }, null, 2));
}

function undo(ma: string) {
  const dir = join(UNDO_DIR, ma);
  if (!existsSync(dir)) fail(`không có bản hoàn tác của ${ma} trong ${relative(root, UNDO_DIR)}`);
  const list = JSON.parse(readFileSync(join(dir, 'tep-moi.json'), 'utf8')) as { created: string[]; changed: string[] };
  for (const file of list.changed) { writeFileSync(P(file), readFileSync(join(dir, 'ban-cu', file))); console.log(`  trả lại   ${file}`); }
  for (const file of list.created) if (existsSync(P(file))) { rmSync(P(file)); console.log(`  xóa       ${file}`); }
  // Folders the run created and left empty (the feature folder, a new Categories folder...).
  for (const file of list.created) {
    let folder = dirname(P(file));
    while (folder.startsWith(root) && folder !== root && existsSync(folder) && readdirSync(folder).length === 0) { rmSync(folder, { recursive: true }); folder = dirname(folder); }
  }
  rmSync(dir, { recursive: true });
  if (existsSync(UNDO_DIR) && readdirSync(UNDO_DIR).length === 0) rmSync(UNDO_DIR, { recursive: true });
  console.log(`Đã hoàn tác ${ma}. Nếu đã chạy script SQL: DROP TABLE bảng của danh mục; nếu backend đã khởi động với nó: xóa dòng ${ma} trong sys_command.`);
}

// --------------------------------------------------------------------------------------------------------------- main
const args = process.argv.slice(2);
if (args.includes('--khung')) { writeKit(); process.exit(0); }
const undoIndex = args.indexOf('--hoan-tac');
if (undoIndex >= 0) { undo(args[undoIndex + 1] ?? fail('cần mã chức năng: --hoan-tac inv_brand_cat')); process.exit(0); }
const specPath = args.find(a => !a.startsWith('--'));
if (!specPath) fail('cần đường dẫn file mô tả: npm run tao-danh-muc -- duong/dan/mo-ta.json [--thu]');
const spec = load(specPath!);
const t = plan(spec);
const dry = args.includes('--thu');
console.log(`${dry ? 'Sẽ' : 'Đã'} tạo danh mục ${t.ma} (${t.tenVi}):`);
for (const c of changes) console.log(`  ${c.what.padEnd(14)} ${relative(root, c.file)}`);
if (dry) process.exit(0);
saveUndo(t.ma);
for (const c of changes) c.apply();
const sqlName = relative(root, created[0]);
console.log(`
Việc còn lại:
  1. Chạy script SQL trên database: ${sqlName}
  2. Dừng backend, rồi: cd ServerService && dotnet build Core.sln && dotnet test tests/Core.Tests/Core.Tests.csproj
  3. cd Frontend && npm run lint && npm run check-i18n && npm run check-menu
  4. Khởi động lại backend (mã chức năng và nút menu được thêm khi khởi động), mở menu ${t.tenVi}.
  5. Màn khác cần chọn mã từ danh mục này: thêm mã chức năng của màn đó vào Rule("${t.tens}", ...) trong LookupAccess.cs, rồi dùng <CatalogLookup lookup="${t.tens}" />.
  6. Luật riêng (kiểm tra thêm, dữ liệu liên quan) viết trong ApplyAsync của ${t.Ten}Service; cấp quyền cho vai trò ở Cài đặt › Người dùng & phân quyền.
  7. Từ điển cơ sở dữ liệu: mô tả bảng ${t.bang} ở docs/cong-cu/gen-database-doc.cjs, chạy node docs/cong-cu/gen-database-doc.cjs.
Không đúng ý (và chưa sửa gì thêm vào các tệp đó): npm run tao-danh-muc -- --hoan-tac ${t.ma}
Đúng ý thì xóa bản hoàn tác: thư mục .tao-danh-muc/${t.ma}`);
