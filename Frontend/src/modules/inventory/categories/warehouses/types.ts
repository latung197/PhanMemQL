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
  /** Company units that may use the warehouse; empty = shared, every unit may use it. */
  unitCodes: string[];
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
  /** Unit codes separated by commas (the form of an Excel cell); an empty text makes the warehouse shared. */
  unitCodes: string;
  version?: number;
}
