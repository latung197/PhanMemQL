import type { RecordStamp } from '../../../../components/common/RecordStamp';

export interface UomConversionRecord {
  code: string;
  materialCode?: string | null;
  materialName?: string | null;
  fromUomCode: string;
  fromUomName: string;
  toUomCode: string;
  toUomName: string;
  factor: number;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveUomConversionInput {
  code: string;
  materialCode: string;
  materialName: string;
  fromUomCode: string;
  toUomCode: string;
  factor: number;
  note: string;
  isActive: boolean;
  version?: number;
}
