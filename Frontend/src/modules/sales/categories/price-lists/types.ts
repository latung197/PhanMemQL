import type { RecordStamp } from '../../../../components/common/RecordStamp';

export interface PriceListRecord {
  code: string;
  name: string;
  currencyCode: string;
  customerGroupCode?: string | null;
  customerGroupName?: string | null;
  /** yyyy-MM-dd */
  validFrom: string;
  validTo?: string | null;
  note?: string | null;
  isActive: boolean;
  lineCount: number;
  stamp: RecordStamp;
  version: number;
}

/** One price of a price list: the material in a unit, from a quantity on (0 = from the first unit). */
export interface PriceListLine {
  materialCode: string;
  materialName?: string | null;
  uomCode: string;
  minQuantity: number;
  unitPrice: number;
  note?: string | null;
}

export interface SavePriceListInput {
  code: string;
  name: string;
  currencyCode: string;
  customerGroupCode: string;
  validFrom: string;
  /** null = no end. */
  validTo: string | null;
  note: string;
  isActive: boolean;
  version?: number;
  /** undefined = the lines were not loaded / changed: the server keeps the saved ones. */
  lines?: PriceListLine[];
}
