import type { RecordStamp } from '../../../../components/common/RecordStamp';

export type LotQuality = 'PASSED' | 'INSPECT' | 'BLOCKED';
/** Worked out by the backend as of today: none (no expiry date), ok, near (within 30 days) or expired. */
export type LotExpiryState = 'none' | 'ok' | 'near' | 'expired';

/** A lot of a material tracked by lot (erp_lot). Its code is "VT001@LOT-2610" (material + lot number). */
export interface LotRecord {
  code: string;
  materialCode: string;
  materialName?: string | null;
  lotNo: string;
  mfgDate?: string | null;
  expDate?: string | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  qualityStatus: LotQuality;
  expiryState: LotExpiryState;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveLotInput {
  materialCode: string;
  lotNo: string;
  mfgDate: string | null;
  expDate: string | null;
  supplierCode: string;
  qualityStatus: LotQuality;
  note: string;
  isActive: boolean;
  version?: number;
}
