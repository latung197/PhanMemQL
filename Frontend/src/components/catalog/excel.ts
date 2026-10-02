// Real .xlsx files for catalog screens (export, import, template), with exceljs loaded only when a file is made or
// read so it is not part of the main bundle.
import { translate } from '../../utils/i18n';
import type { ExcelColumn } from './catalogTypes';

const loadExcel = async () => (await import('exceljs')).default;

const download = (buffer: ArrayBuffer, fileName: string) => {
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

const cellValue = (value: unknown, type: ExcelColumn<unknown>['type']) => {
  if (value === null || value === undefined) return '';
  if (type === 'boolean') return value ? translate('catalog.excel.yes') : translate('catalog.excel.no');
  return value as string | number;
};

/** Writes the rows (one per record) with a bold, frozen header row. */
export async function exportExcel<TInput>(fileName: string, sheetName: string, columns: ExcelColumn<TInput>[], rows: TInput[]) {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width ?? Math.max(12, c.header.length + 4) }));
  rows.forEach(row => sheet.addRow(Object.fromEntries(columns.map(c => [c.key, cellValue(row[c.key], c.type)]))));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  download(await workbook.xlsx.writeBuffer() as ArrayBuffer, `${fileName}_${today()}.xlsx`);
}

/** Empty file to fill in: the columns, one example row, and a sheet explaining them. */
export async function downloadTemplate<TInput>(fileName: string, sheetName: string, columns: ExcelColumn<TInput>[]) {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width ?? Math.max(12, c.header.length + 4) }));
  sheet.addRow(Object.fromEntries(columns.map(c => [c.key, cellValue(c.example ?? '', c.type)])));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const help = workbook.addWorksheet(translate('catalog.excel.helpSheet'));
  help.columns = [{ header: translate('catalog.excel.helpColumn'), width: 30 }, { header: translate('catalog.excel.helpNote'), width: 70 }];
  columns.forEach(c => help.addRow([c.header, [
    c.required ? translate('catalog.excel.required') : translate('catalog.excel.optional'),
    c.type === 'boolean' ? translate('catalog.excel.booleanHint') : ''
  ].filter(Boolean).join('. ')]));
  help.getRow(1).font = { bold: true };
  download(await workbook.xlsx.writeBuffer() as ArrayBuffer, `${fileName}_mau.xlsx`);
}

const normalizeHeader = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*\*$/, '');

const TRUE_WORDS = ['1', 'x', 'true', 'có', 'co', 'yes', 'y', 'đang dùng', 'dang dung', 'active'];
const FALSE_WORDS = ['0', 'false', 'không', 'khong', 'no', 'n', 'ngừng dùng', 'ngung dung', 'inactive'];

/** Text of a cell whatever exceljs gives (rich text, formula result, hyperlink, date). */
const textOf = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as { richText?: { text: string }[]; result?: unknown; text?: unknown };
    if (v.richText) return v.richText.map(r => r.text).join('');
    if (v.result !== undefined) return textOf(v.result);
    if (v.text !== undefined) return textOf(v.text);
  }
  return String(value).trim();
};

export interface ReadRow<TInput> {
  /** Row number in the Excel sheet (for messages). */
  excelRow: number;
  input: TInput;
  /** Problems found before sending (missing required value, unreadable yes / no...). */
  problems: string[];
}

export interface ReadResult<TInput> {
  rows: ReadRow<TInput>[];
  /** Required columns missing from the header row. */
  missingColumns: string[];
}

/** Reads the first sheet: the header row is matched to the columns by title (or key), empty rows are skipped. */
export async function readExcel<TInput>(file: File, columns: ExcelColumn<TInput>[], empty: TInput): Promise<ReadResult<TInput>> {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], missingColumns: columns.filter(c => c.required).map(c => c.header) };

  const positions = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const title = normalizeHeader(textOf(cell.value));
    const column = columns.find(c => normalizeHeader(c.header) === title || c.key.toLowerCase() === title);
    if (column && !positions.has(column.key)) positions.set(column.key, col);
  });
  const missingColumns = columns.filter(c => c.required && !positions.has(c.key)).map(c => c.header);

  const rows: ReadRow<TInput>[] = [];
  sheet.eachRow((row, excelRow) => {
    if (excelRow === 1) return;
    const texts = columns.map(c => positions.has(c.key) ? textOf(row.getCell(positions.get(c.key)!).value) : '');
    if (texts.every(t => t === '')) return;
    const input = { ...empty } as Record<string, unknown>;
    const problems: string[] = [];
    columns.forEach((c, i) => {
      const text = texts[i];
      if (!positions.has(c.key)) return;
      if (c.required && text === '') problems.push(translate('catalog.import.requiredValue', { column: c.header }));
      if (c.type === 'boolean') {
        const word = text.toLowerCase();
        if (word === '') return;
        if (TRUE_WORDS.includes(word)) input[c.key] = true;
        else if (FALSE_WORDS.includes(word)) input[c.key] = false;
        else problems.push(translate('catalog.import.badBoolean', { column: c.header, value: text }));
      } else if (c.type === 'number') {
        if (text === '') return;
        const n = Number(text.replace(',', '.'));
        if (Number.isFinite(n)) input[c.key] = n;
        else problems.push(translate('catalog.import.badNumber', { column: c.header, value: text }));
      } else {
        input[c.key] = text;
      }
    });
    rows.push({ excelRow, input: input as TInput, problems });
  });
  return { rows, missingColumns };
}
