// Checks the code of a stock label (utils/stockLabel.ts): what is printed on a tem is what the stock count screen reads back.
import { encodeStockLabel, parseStockLabel } from '../src/utils/stockLabel';

let failed = 0;
const check = (name: string, ok: boolean) => { if (!ok) failed++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

check('material only', encodeStockLabel('vt001') === 'VT001');
check('material and lot', encodeStockLabel('VT001', 'lot-2610') === 'VT001#LOT-2610');
check('material, lot and location', encodeStockLabel('VT001', 'lot-2610', 'a-01') === 'VT001#LOT-2610#A-01');
check('a location without a lot keeps the empty lot', encodeStockLabel('VT001', '', 'A-01') === 'VT001##A-01');
check('trailing empty parts are dropped', encodeStockLabel('VT001', null, '  ') === 'VT001');
check('the separator inside a part is replaced', encodeStockLabel('VT001', 'L#1|x') === 'VT001#L-1-X');

check('parse: all three parts', same(parseStockLabel('VT001#LOT-2610#A-01'), { material: 'VT001', lot: 'LOT-2610', position: 'A-01' }));
check('parse: lower case and spaces from a scanner', same(parseStockLabel('  vt001#lot-2610 \r\n'), { material: 'VT001', lot: 'LOT-2610', position: '' }));
check('parse: the pipe of labels printed elsewhere', same(parseStockLabel('VT001|LOT-2610'), { material: 'VT001', lot: 'LOT-2610', position: '' }));
check('parse: a location without a lot', same(parseStockLabel('VT001##A-01'), { material: 'VT001', lot: '', position: 'A-01' }));
check('parse: nothing', parseStockLabel('') === null && parseStockLabel('   ') === null);
check('parse: no material code', parseStockLabel('#LOT') === null);
for (const [m, l, p] of [['VT001', '', ''], ['VT001', 'LOT-1', ''], ['VT001', 'LOT-1', 'A-01'], ['VT001', '', 'A-01']] as const) {
  const back = parseStockLabel(encodeStockLabel(m, l, p));
  check(`round trip ${m}/${l}/${p}`, same(back, { material: m, lot: l, position: p }));
}

console.log(failed ? `FAILED ${failed}` : 'ALL OK');
process.exit(failed ? 1 : 0);
