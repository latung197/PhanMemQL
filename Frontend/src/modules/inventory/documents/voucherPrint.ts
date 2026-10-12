// Print form of the goods vouchers (receipt, issue): an A4 page built as HTML and printed from the browser, in two templates:
// with prices and amounts (for accounting) and without (for the warehouse / the carrier, who must not see prices).
// Vietnamese on purpose: it is the printed paper, not a screen text.
import type { GoodsVoucher, VoucherItem } from '../../../types';
import type { CompanyProfileConfig } from '../../../services/systemSettingsService';

export type VoucherPrintKind = 'receipt' | 'issue';

export interface VoucherPrintFormat {
  quantity: (value: number) => string;
  unitPrice: (value: number) => string;
  amount: (value: number) => string;
}

export interface VoucherPrintOptions {
  kind: VoucherPrintKind;
  /** true = the template with unit prices, amounts and the total in words. */
  withPrice: boolean;
  voucher: GoodsVoucher;
  company: CompanyProfileConfig;
  format: VoucherPrintFormat;
  printedBy?: string;
}

// What changes between a receipt and an issue (the issue keeps the customer in supplierName and the receiver in delivererName).
const KINDS: Record<VoucherPrintKind, { title: string; form: string; warehouse: string; type: string; partner: string; person: string;
  signatures: [string, string, string, string]; typeFallback: string }> = {
  receipt: { title: 'PHIẾU NHẬP KHO', form: 'Mẫu số 01 - VT', warehouse: 'Nhập tại kho', type: 'Loại nhập', partner: 'Nhà cung cấp',
    person: 'Người giao hàng', signatures: ['Người lập phiếu', 'Người giao hàng', 'Thủ kho', 'Kế toán trưởng'], typeFallback: 'Nhập mua mới' },
  issue: { title: 'PHIẾU XUẤT KHO', form: 'Mẫu số 02 - VT', warehouse: 'Xuất tại kho', type: 'Loại xuất', partner: 'Khách hàng',
    person: 'Người nhận hàng', signatures: ['Người lập phiếu', 'Người nhận hàng', 'Thủ kho', 'Kế toán trưởng'], typeFallback: 'Xuất bán hàng' }
};

const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch);

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const GROUPS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

/** Reads 0 to 999. `full` writes "không trăm" for a group that is not the first one ("một triệu không trăm lẻ năm nghìn"). */
function readGroup(n: number, full: boolean): string {
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const ones = n % 10;
  const parts: string[] = [];
  if (hundreds > 0 || full) parts.push(DIGITS[hundreds], 'trăm');
  if (tens > 1) {
    parts.push(DIGITS[tens], 'mươi');
    if (ones === 1) parts.push('mốt');
    else if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(DIGITS[ones]);
  } else if (tens === 1) {
    parts.push('mười');
    if (ones === 5) parts.push('lăm');
    else if (ones > 0) parts.push(DIGITS[ones]);
  } else if (ones > 0) {
    if (hundreds > 0 || full) parts.push('lẻ');
    parts.push(DIGITS[ones]);
  }
  return parts.join(' ');
}

/** 1.250.000 → "Một triệu hai trăm năm mươi nghìn đồng." (whole dong; amounts are rounded). */
export function amountInWords(value: number): string {
  const total = Math.round(Math.abs(value));
  if (!Number.isFinite(total)) return '';
  if (total === 0) return 'Không đồng.';
  const groups: number[] = [];
  for (let rest = total; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const first = words.length === 0;
    words.push(readGroup(groups[i], !first), GROUPS[i]);
  }
  const text = words.filter(Boolean).join(' ');
  return `${(value < 0 ? 'Âm ' : '')}${text.charAt(0).toUpperCase()}${text.slice(1)} đồng.`;
}

const STYLE = `
@page { size: A4; margin: 12mm 12mm 14mm; }
* { box-sizing: border-box; }
body { font-family: "Times New Roman", Times, serif; font-size: 13px; color: #111; margin: 0; padding: 0; line-height: 1.4; }
.sheet { max-width: 186mm; margin: 0 auto; }
.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.company { font-size: 12px; }
.company strong { display: block; font-size: 13px; text-transform: uppercase; }
.form { text-align: center; font-size: 11px; min-width: 150px; }
.form em { display: block; font-style: normal; font-weight: 700; }
.title { text-align: center; margin: 14px 0 2px; }
.title h1 { font-size: 22px; letter-spacing: 1px; margin: 0; }
.title .date { font-style: italic; margin-top: 2px; }
.title .no { margin-top: 2px; }
.info { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 24px; margin: 12px 0 8px; }
.info div { display: flex; gap: 6px; }
.info b { white-space: nowrap; font-weight: 700; }
.info .wide { grid-column: 1 / -1; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; }
th, td { border: 1px solid #333; padding: 4px 5px; vertical-align: top; font-size: 12px; }
th { background: #e9edf2; text-align: center; font-size: 12px; }
td.n, th.n { text-align: right; white-space: nowrap; }
td.c { text-align: center; }
tr { page-break-inside: avoid; }
tfoot td { font-weight: 700; background: #f5f7fa; }
.sub { margin: 14px 0 0; font-weight: 700; }
.words { margin-top: 8px; }
.note { margin-top: 6px; }
.sign { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 22px; text-align: center; page-break-inside: avoid; }
.sign b { display: block; }
.sign span { display: block; font-size: 11px; font-style: italic; }
.sign .space { height: 64px; }
.foot { margin-top: 20px; font-size: 10px; color: #555; display: flex; justify-content: space-between; border-top: 1px solid #bbb; padding-top: 4px; }
@media print { .noprint { display: none; } }
`;

const longDate = (iso: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return match ? `Ngày ${Number(match[3])} tháng ${Number(match[2])} năm ${match[1]}` : '';
};
const shortDate = (iso?: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};

/** The HTML of the print form. */
export function buildVoucherPrintHtml(options: VoucherPrintOptions): string {
  const { kind, withPrice, voucher, company, format, printedBy } = options;
  const labels = KINDS[kind];
  const lines = voucher.items ?? [];
  const showLot = lines.some(x => x.lotNumber);
  const showPosition = lines.some(x => x.position);
  const foreign = Boolean(voucher.currencyCode) && voucher.currencyCode !== 'VND';
  const sumForeign = lines.reduce((sum, x) => sum + (x.totalPrice ?? x.quantity * x.unitPrice), 0);

  const lineRows = (items: VoucherItem[], priced: boolean, lot: boolean, position: boolean): string => items.map((item, index) => `<tr>
    <td class="c">${index + 1}</td><td>${escapeHtml(item.sku ?? item.productId)}</td><td>${escapeHtml(item.productName)}</td>
    <td class="c">${escapeHtml(item.unit)}</td>${lot ? `<td>${escapeHtml(item.lotNumber)}</td>` : ''}${position ? `<td>${escapeHtml(item.position)}</td>` : ''}
    <td class="n">${escapeHtml(format.quantity(item.quantity))}</td>
    ${priced ? `<td class="n">${escapeHtml(format.unitPrice(item.unitPrice))}</td><td class="n">${escapeHtml(format.amount(item.totalPrice ?? item.quantity * item.unitPrice))}</td>` : ''}</tr>`).join('');

  const head = `<tr><th style="width:30px">STT</th><th style="width:98px">Mã vật tư</th><th>Tên vật tư</th><th style="width:44px">ĐVT</th>
    ${showLot ? '<th style="width:72px">Số lô</th>' : ''}${showPosition ? '<th style="width:72px">Vị trí</th>' : ''}<th style="width:58px">Số lượng</th>
    ${withPrice ? '<th style="width:80px">Đơn giá</th><th style="width:92px">Thành tiền</th>' : ''}</tr>`;
  const spanBeforeTotal = 4 + (showLot ? 1 : 0) + (showPosition ? 1 : 0) + 1;
  const total = withPrice ? `<tfoot>
    ${foreign ? `<tr><td colspan="${spanBeforeTotal + 1}" style="text-align:right">Cộng thành tiền (${escapeHtml(voucher.currencyCode)})</td><td class="n">${escapeHtml(format.amount(sumForeign))}</td></tr>` : ''}
    <tr><td colspan="${spanBeforeTotal + 1}" style="text-align:right">Tổng cộng${foreign ? ` quy đổi (VND, tỷ giá ${escapeHtml(voucher.exchangeRate ?? 1)})` : ''}</td><td class="n">${escapeHtml(format.amount(voucher.totalValue))}</td></tr></tfoot>` : '';

  const materials = voucher.materialItems ?? [];
  const materialTable = materials.length === 0 ? '' : `<p class="sub">Định mức nguyên vật liệu (tham chiếu, không ghi sổ kho)</p>
    <table><thead><tr><th style="width:30px">STT</th><th style="width:98px">Mã vật tư</th><th>Tên vật tư</th><th style="width:44px">ĐVT</th><th style="width:58px">Số lượng</th></tr></thead>
    <tbody>${materials.map((item, index) => `<tr><td class="c">${index + 1}</td><td>${escapeHtml(item.sku ?? item.productId)}</td><td>${escapeHtml(item.productName)}</td><td class="c">${escapeHtml(item.unit)}</td><td class="n">${escapeHtml(format.quantity(item.quantity))}</td></tr>`).join('')}</tbody></table>`;

  const approved = voucher.approvedBy ? `<div><b>Người duyệt:</b> ${escapeHtml(voucher.approvedBy)}</div>` : '';
  const signatures = labels.signatures.map((caption, index) => {
    // Names we know are printed under the caption: the maker and the chief accountant.
    const name = index === 0 ? voucher.createdBy : index === 3 ? company.chiefAccountant : '';
    return `<div><b>${escapeHtml(caption)}</b><span>(Ký, họ tên)</span><div class="space"></div>${name ? escapeHtml(name) : ''}</div>`;
  }).join('');

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(labels.title)} ${escapeHtml(voucher.code)}</title><style>${STYLE}</style></head><body><div class="sheet">
  <div class="top">
    <div class="company"><strong>${escapeHtml(company.companyName)}</strong>${company.address ? `${escapeHtml(company.address)}<br>` : ''}${company.taxCode ? `MST: ${escapeHtml(company.taxCode)}` : ''}${company.phone ? ` · ĐT: ${escapeHtml(company.phone)}` : ''}</div>
    <div class="form"><em>${escapeHtml(labels.form)}</em>${withPrice ? '' : '(Bản không giá)'}</div>
  </div>
  <div class="title"><h1>${labels.title}</h1><div class="date">${escapeHtml(longDate(voucher.date))}</div><div class="no">Số: <b>${escapeHtml(voucher.code)}</b></div></div>
  <div class="info">
    <div><b>Đơn vị:</b> ${escapeHtml(voucher.companyUnitName)}</div>
    <div><b>${labels.warehouse}:</b> ${escapeHtml(voucher.warehouseName)}</div>
    <div><b>${labels.type}:</b> ${escapeHtml(voucher.voucherType || labels.typeFallback)}</div>
    <div><b>${labels.partner}:</b> ${escapeHtml(voucher.supplierName)}</div>
    <div><b>${labels.person}:</b> ${escapeHtml(voucher.delivererName)}</div>
    ${approved}
    ${withPrice && foreign ? `<div><b>Loại tiền:</b> ${escapeHtml(voucher.currencyCode)} · tỷ giá ${escapeHtml(voucher.exchangeRate ?? 1)}</div>` : ''}
    ${voucher.note ? `<div class="wide"><b>Ghi chú:</b> ${escapeHtml(voucher.note)}</div>` : ''}
  </div>
  <table><thead>${head}</thead>${total}<tbody>${lineRows(lines, withPrice, showLot, showPosition)}</tbody></table>
  ${withPrice ? `<p class="words"><b>Tổng số tiền (viết bằng chữ):</b> <i>${escapeHtml(amountInWords(voucher.totalValue))}</i></p>` : ''}
  ${materialTable}
  <div class="sign">${signatures}</div>
  <div class="foot"><span>In ngày ${escapeHtml(shortDate(new Date().toISOString().slice(0, 10)))}${printedBy ? ` · ${escapeHtml(printedBy)}` : ''}</span><span>${escapeHtml(voucher.code)}${withPrice ? '' : ' · bản không giá'}</span></div>
  </div></body></html>`;
}

/** Opens the print window; false when the browser blocked it. */
export function printVoucher(options: VoucherPrintOptions): boolean {
  const printable = window.open('', '_blank');
  if (!printable) return false;
  printable.document.write(buildVoucherPrintHtml(options));
  printable.document.close();
  printable.focus();
  // Let the page lay out first, or some browsers print it blank.
  window.setTimeout(() => printable.print(), 250);
  return true;
}
