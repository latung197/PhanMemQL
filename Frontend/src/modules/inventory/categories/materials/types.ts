import type { RecordStamp } from '../../../../components/common/RecordStamp';

/** One line of the conversions grid: 1 uomCode = factor base units of the material. */
export interface MaterialUomRecord {
  uomCode: string;
  uomName?: string | null;
  factor: number;
  note?: string | null;
  isActive: boolean;
}

export type CostingMethod = 'AVERAGE' | 'FIFO';

/** A material from the backend catalog (erp_material); the code is the key. */
export interface MaterialRecord {
  code: string;
  name: string;
  customerMaterialCode?: string | null;
  partNo?: string | null;
  materialTypeCode?: string | null;
  materialTypeName?: string | null;
  materialGroupCode?: string | null;
  materialGroupName?: string | null;
  /** Base unit of measure: stock is kept in it. */
  uomCode: string;
  uomName?: string | null;
  vatTaxRateCode?: string | null;
  importTaxRateCode?: string | null;
  /** False for a service / expense item: no stock, none of the tracking flags apply. */
  isStockItem: boolean;
  trackLot: boolean;
  /** The expiry date lives on the lot, so this needs trackLot. */
  hasExpiry: boolean;
  shelfLifeDays?: number | null;
  trackLocation: boolean;
  isCycleCounted: boolean;
  costingMethod: CostingMethod;
  minStock?: number | null;
  maxStock?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  weight?: number | null;
  volume?: number | null;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
  /** Units other than the base unit: 1 unit = factor base units. */
  conversions?: MaterialUomRecord[];
}

export interface SaveMaterialInput {
  code: string;
  name: string;
  uomCode: string;
  customerMaterialCode: string;
  partNo: string;
  materialTypeCode: string;
  materialGroupCode: string;
  vatTaxRateCode: string;
  importTaxRateCode: string;
  isStockItem: boolean;
  trackLot: boolean;
  hasExpiry: boolean;
  shelfLifeDays: number | null;
  trackLocation: boolean;
  isCycleCounted: boolean;
  costingMethod: CostingMethod;
  minStock: number | null;
  maxStock: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  weight: number | null;
  volume: number | null;
  note: string;
  isActive: boolean;
  version?: number;
  conversions?: { uomCode: string; factor: number; note: string; isActive: boolean }[];
}
