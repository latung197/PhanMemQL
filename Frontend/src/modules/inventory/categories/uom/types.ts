import type { RecordStamp } from '../../../../components/common/RecordStamp';

/** A unit of measure from the backend catalog (erp_uom); the code is the key. */
export interface Uom {
  code: string;
  /** Vietnamese fallback name stored on erp_uom. */
  name: string;
  localizedName: string;
  translations: UomTranslation[];
  /** Printed after quantities (cái, kg, m). */
  symbol: string;
  note?: string | null;
  isActive: boolean;
  /** Who created / last changed it and when (filled by the backend). */
  stamp: RecordStamp;
  /** Row version; sent back when saving so a change made meanwhile by someone else is not overwritten. */
  version: number;
}

export interface UomTranslation {
  languageCode: string;
  name: string;
}

export interface SaveUomInput {
  code: string;
  name: string;
  symbol: string;
  note: string;
  isActive: boolean;
  version?: number;
  translations?: UomTranslation[];
}
