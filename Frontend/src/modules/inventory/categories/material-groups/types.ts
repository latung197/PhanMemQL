import type { RecordStamp } from '../../../../components/common/RecordStamp';

export interface MaterialGroupRecord {
  code: string;
  name: string;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveMaterialGroupInput {
  code: string;
  name: string;
  note: string;
  isActive: boolean;
  version?: number;
}
