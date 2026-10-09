import type { RecordStamp } from '../../../../components/common/RecordStamp';

export interface MaterialTypeRecord {
  code: string;
  name: string;
  groupName?: string | null;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveMaterialTypeInput {
  code: string;
  name: string;
  groupName: string;
  note: string;
  isActive: boolean;
  version?: number;
}
