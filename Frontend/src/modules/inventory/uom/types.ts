import type { RecordStamp } from '../../../components/common/RecordStamp';

/** A unit of measure from the backend catalog (erp_uom); the code is the key. */
export interface Uom {
  code: string;
  name: string;
  /** Printed after quantities (cái, kg, m). */
  symbol: string;
  note?: string | null;
  isActive: boolean;
  /** Who created / last changed it and when (filled by the backend). */
  stamp: RecordStamp;
}

export interface SaveUomInput {
  code: string;
  name: string;
  symbol: string;
  note: string;
  isActive: boolean;
}
