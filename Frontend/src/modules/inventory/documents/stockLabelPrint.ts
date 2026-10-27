// Print form of the stock labels (tem sản phẩm) made when goods come in: one label per page, sized for a label roll (the browser prints
// them on any label printer installed as a normal printer), with a Code 128 barcode (every scanner reads it) or a QR code (phones and
// 2D scanners). The text of the code is MATERIAL#LOT#LOCATION (utils/stockLabel.ts), what the stock count screen reads back.
// Vietnamese on purpose: it is the printed paper, not a screen text.
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { encodeStockLabel } from '../../../utils/stockLabel';

export type LabelSymbology = 'code128' | 'qr';
export const LABEL_SIZES = { '50x30': { w: 50, h: 30 }, '70x40': { w: 70, h: 40 }, '100x50': { w: 100, h: 50 } } as const;
export type LabelSize = keyof typeof LABEL_SIZES;

export interface StockLabelLine {
  materialCode: string;
  materialName: string;
  unit?: string;
  lotNumber?: string;
  position?: string;
  /** How many labels to print for this line. */
  copies: number;
}

export interface StockLabelOptions {
  lines: StockLabelLine[];
  symbology: LabelSymbology;
  size: LabelSize;
  /** The voucher the goods came in with and its date, printed small on the label. */
  voucherCode?: string;
  date?: string;
}

const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch);

const shortDate = (iso?: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};

const barcodeSvg = (text: string, heightMm: number): string => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, text, { format: 'CODE128', displayValue: false, margin: 0, height: 40, width: 2 });
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('style', `width:100%;height:${heightMm}mm;display:block`);
  return svg.outerHTML;
};

const qrSvg = async (text: string, sizeMm: number): Promise<string> => {
  const svg = await QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  return svg.replace('<svg ', `<svg style="width:${sizeMm}mm;height:${sizeMm}mm;display:block" `);
};

/** The HTML of all the labels (one `.label` per copy). */
export async function buildStockLabelsHtml(options: StockLabelOptions): Promise<string> {
  const { lines, symbology, size, voucherCode, date } = options;
  const { w, h } = LABEL_SIZES[size];
  const labels: string[] = [];
  for (const line of lines) {
    const code = encodeStockLabel(line.materialCode, line.lotNumber, line.position);
    // One image per line, repeated for its copies.
    const picture = symbology === 'qr' ? await qrSvg(code, Math.min(h - 4, w * 0.42)) : barcodeSvg(code, Math.max(6, h * 0.3));
    const meta = [
      line.lotNumber ? `Lô: <b>${escapeHtml(line.lotNumber)}</b>` : '',
      line.position ? `Vị trí: <b>${escapeHtml(line.position)}</b>` : '',
      line.unit ? `ĐVT: ${escapeHtml(line.unit)}` : ''
    ].filter(Boolean).join(' &nbsp; ');
    const html = symbology === 'qr'
      ? `<div class="label qr"><div class="qr-pic">${picture}</div><div class="qr-text"><div class="name">${escapeHtml(line.materialName)}</div>
         <div class="code">${escapeHtml(line.materialCode)}</div><div class="meta">${meta}</div><div class="foot">${escapeHtml(voucherCode)} ${escapeHtml(shortDate(date))}</div></div></div>`
      : `<div class="label"><div class="name">${escapeHtml(line.materialName)}</div>${picture}<div class="code">${escapeHtml(code)}</div>
         <div class="meta">${meta}</div><div class="foot">${escapeHtml(voucherCode)} ${escapeHtml(shortDate(date))}</div></div>`;
    for (let i = 0; i < Math.max(1, Math.floor(line.copies)); i++) labels.push(html);
  }
  const nameSize = Math.max(8, Math.round(h * 0.22));
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Tem sản phẩm ${escapeHtml(voucherCode)}</title><style>
@page { size: ${w}mm ${h}mm; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
.label { width: ${w}mm; height: ${h}mm; padding: 1.6mm 2mm; page-break-after: always; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; }
.label:last-child { page-break-after: auto; }
.name { font-size: ${nameSize}px; font-weight: 700; line-height: 1.15; max-height: 2.4em; overflow: hidden; }
.code { font-family: "Courier New", monospace; font-size: ${Math.max(9, Math.round(h * 0.26))}px; font-weight: 700; text-align: center; letter-spacing: .5px; word-break: break-all; }
.meta { font-size: ${Math.max(7, Math.round(h * 0.19))}px; text-align: center; }
.foot { font-size: ${Math.max(6, Math.round(h * 0.15))}px; color: #333; text-align: center; }
.label.qr { flex-direction: row; align-items: center; justify-content: flex-start; gap: 2mm; }
.qr-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.6mm; }
.qr-text .code, .qr-text .meta, .qr-text .foot { text-align: left; }
</style></head><body>${labels.join('')}</body></html>`;
}

/** Opens the print window; false when the browser blocked it. */
export async function printStockLabels(options: StockLabelOptions): Promise<boolean> {
  const printable = window.open('', '_blank');
  if (!printable) return false;
  printable.document.write(await buildStockLabelsHtml(options));
  printable.document.close();
  printable.focus();
  // Let the page lay out first, or some browsers print it blank.
  window.setTimeout(() => printable.print(), 300);
  return true;
}
