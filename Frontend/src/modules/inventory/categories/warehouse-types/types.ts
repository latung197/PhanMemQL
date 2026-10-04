import type { RecordStamp } from '../../../../components/common/RecordStamp';

export interface WarehouseTypeTranslation {
  languageCode: string;
  name: string;
}

export interface WarehouseTypeRecord {
  code: string;
  name: string;
  localizedName: string;
  note?: string | null;
  isActive: boolean;
  translations: WarehouseTypeTranslation[];
  stamp: RecordStamp;
  version: number;
}

export interface SaveWarehouseTypeInput {
  code: string;
  name: string;
  note: string;
  isActive: boolean;
  translations?: WarehouseTypeTranslation[];
  version?: number;
}
