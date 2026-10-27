// The code printed on a stock label (tem sản phẩm) and read back by the stock count screen: MATERIAL#LOT#LOCATION, upper case, the
// trailing empty parts left out (VT001, VT001#LOT-2610, VT001#LOT-2610#A-01, VT001##A-01 for a location without a lot).
// "#" is the separator because it is typed the same on every keyboard layout a handheld scanner may emulate ("|" is not), and the
// parser also accepts "|" for labels printed elsewhere. Material codes, lot numbers and locations never contain it (it is replaced
// by "-" when a label is made).
export const STOCK_LABEL_SEPARATOR = '#';

export interface StockLabelCode {
  material: string;
  lot: string;
  position: string;
}

const clean = (value?: string | null) => (value ?? '').trim().toUpperCase().replace(/[#|]/g, '-');

export const encodeStockLabel = (material: string, lot?: string | null, position?: string | null): string => {
  const parts = [clean(material), clean(lot), clean(position)];
  while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
  return parts.join(STOCK_LABEL_SEPARATOR);
};

/** The parts of a scanned text, or null when it holds no material code. Scanners may add spaces or a line break around the text. */
export const parseStockLabel = (text: string): StockLabelCode | null => {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  const [material, lot = '', position = ''] = raw.split(/[#|]/).map(part => part.trim().toUpperCase());
  return material ? { material, lot, position } : null;
};
