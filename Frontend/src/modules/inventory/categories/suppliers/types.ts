import type { RecordStamp } from '../../../../components/common/RecordStamp';

export interface SupplierRecord {
  code: string;
  name: string;
  taxCode?: string | null;
  phone?: string | null;
  address?: string | null;
  supplierGroupCode?: string | null;
  supplierGroupName?: string | null;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveSupplierInput {
  code: string;
  name: string;
  taxCode: string;
  phone: string;
  address: string;
  supplierGroupCode: string;
  note: string;
  isActive: boolean;
  version?: number;
}
