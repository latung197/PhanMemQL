import type { RecordStamp } from '../../../../components/common/RecordStamp';

export interface WarehouseRecord {
  code: string;
  name: string;
  warehouseTypeCode?: string | null;
  warehouseTypeName?: string | null;
  address?: string | null;
  manager?: string | null;
  capacity?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveWarehouseInput {
  code: string;
  name: string;
  warehouseTypeCode: string;
  address: string;
  manager: string;
  capacity: string;
  isActive: boolean;
  version?: number;
}
