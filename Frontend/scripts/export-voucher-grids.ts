/**
 * Exports the voucher grids declared in src/mock/voucherGridConfigs.ts to ../ServerService/Core/SeedData/voucher-grids.json.
 * The API inserts the grids and columns the tables sys_voucher_grid / sys_voucher_grid_column do not have yet (insert-only,
 * edits made in the database stay), so a column added in the code shows up at the end of its grid after the next start.
 *
 *   npm run export-voucher-grids
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { systemVoucherGridRegistry } from '../src/mock/voucherGridConfigs';

const number = (value: string | number | undefined) => (value === undefined || value === '' ? null : Number(value));
const TABS: Record<string, { key: string; order: number }> = { ITEMS: { key: 'items', order: 1 }, BOM: { key: 'materials', order: 2 } };

const grids = Object.values(systemVoucherGridRegistry).map(grid => {
  const suffix = grid.gridId.split('_').slice(1).join('_');
  const tab = TABS[suffix] ?? { key: suffix.toLowerCase(), order: 9 };
  return {
    code: grid.gridId,
    voucherType: grid.voucherType,
    name: grid.voucherName,
    tabKey: tab.key,
    tabOrder: tab.order,
    allowAddRow: grid.allowAddRow !== false,
    allowDeleteRow: grid.allowDeleteRow !== false,
    pinCount: 0,
    columns: grid.columns.map((column, index) => ({
      field: column.field,
      header: column.headerName,
      headerEn: column.headerNameEn ?? null,
      type: column.type,
      width: number(column.width),
      minWidth: number(column.minWidth),
      align: column.align ?? 'left',
      decimals: column.decimals ?? null,
      required: !!column.required,
      readOnly: !!column.readOnly,
      summary: column.summary ?? null,
      summaryFormat: column.summaryFormat ?? null,
      sortOrder: (index + 1) * 10
    }))
  };
});

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../../ServerService/Core/SeedData/voucher-grids.json');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(grids, null, 2) + '\n');
console.log(`voucher-grids.json: ${grids.length} grids, ${grids.reduce((n, g) => n + g.columns.length, 0)} columns -> ${file}`);
