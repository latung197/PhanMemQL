import type { RecordStamp } from '../../../../components/common/RecordStamp';

/** A storage location (kệ / tầng / ô) of one warehouse (erp_location); the code is unique across the system. */
export interface StorageLocationRecord {
  code: string;
  name: string;
  warehouseCode: string;
  warehouseName?: string | null;
  zone?: string | null;
  rack?: string | null;
  shelf?: string | null;
  capacity?: number | null;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveStorageLocationInput {
  code: string;
  name: string;
  warehouseCode: string;
  zone: string;
  rack: string;
  shelf: string;
  capacity: number | null;
  note: string;
  isActive: boolean;
  version?: number;
}
