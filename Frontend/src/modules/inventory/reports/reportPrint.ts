// Print form of a stock report: the table as it is on the screen, with the company header, the title and the filters, on an A4 page opened
// from the browser. Vietnamese on purpose: it is the printed paper, not a screen text.
import type { CompanyProfileConfig } from '../../../services/systemSettingsService';

const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch);

const STYLE = `
@page { size: A4 landscape; margin: 10mm; }
* { box-sizing: border-box; }
body { font-family: "Times New Roman", Times, serif; font-size: 12px; color: #111; margin: 0; }
.top { display: flex; justify-content: space-between; gap: 16px; }
.company { font-size: 11px; }
.company strong { display: block; font-size: 12px; text-transform: uppercase; }
h1 { text-align: center; font-size: 20px; margin: 10px 0 2px; text-transform: uppercase; }
.sub { text-align: center; font-style: italic; margin: 0 0 8px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #333; padding: 3px 5px; font-size: 11px; vertical-align: top; }
th { background: #e9edf2; text-align: center; }
td.num, th.num, td[class*="text-right"] { text-align: right; white-space: nowrap; }
tr { page-break-inside: avoid; }
thead { display: table-header-group; }
.foot { margin-top: 10px; font-size: 10px; color: #555; display: flex; justify-content: space-between; }
@media print { .noprint { display: none; } }
`;

export interface ReportPrintOptions {
  title: string;
  /** The filters in words (e.g. "Kho: KHO01 · Từ 01/10/2026 đến 31/10/2026"). */
  subtitle?: string;
  /** outerHTML of the table of the screen. */
  tableHtml: string;
  company: CompanyProfileConfig;
  printedBy?: string;
}

export function buildReportPrintHtml(options: ReportPrintOptions): string {
  const { title, subtitle, tableHtml, company, printedBy } = options;
  const today = new Date().toLocaleDateString('vi-VN');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body>
  <div class="top"><div class="company"><strong>${escapeHtml(company.companyName)}</strong>${company.address ? `${escapeHtml(company.address)}<br>` : ''}${company.taxCode ? `MST: ${escapeHtml(company.taxCode)}` : ''}</div></div>
  <h1>${escapeHtml(title)}</h1>${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ''}
  ${tableHtml}
  <div class="foot"><span>In ngày ${escapeHtml(today)}${printedBy ? ` · ${escapeHtml(printedBy)}` : ''}</span><span>${escapeHtml(title)}</span></div>
  </body></html>`;
}

/** Opens the print window; false when the browser blocked it. */
export function printReportTable(options: ReportPrintOptions): boolean {
  const printable = window.open('', '_blank');
  if (!printable) return false;
  printable.document.write(buildReportPrintHtml(options));
  printable.document.close();
  printable.focus();
  window.setTimeout(() => printable.print(), 300);
  return true;
}
