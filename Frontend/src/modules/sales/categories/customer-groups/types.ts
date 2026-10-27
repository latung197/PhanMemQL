import type { RecordStamp } from '../../../../components/common/RecordStamp';

export interface CustomerGroupRecord {
  code: string;
  name: string;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveCustomerGroupInput {
  code: string;
  name: string;
  note: string;
  isActive: boolean;
  version?: number;
}
