import type { RecordStamp } from '../../../../components/common/RecordStamp';

/** The stock norm of a material in a warehouse (erp_stock_norm). Its code is "VT001@KHO1" (material + warehouse). */
export interface StockNormRecord {
  code: string;
  materialCode: string;
  materialName?: string | null;
  uomCode?: string | null;
  warehouseCode: string;
  warehouseName?: string | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  safetyQuantity?: number | null;
  reorderPoint?: number | null;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveStockNormInput {
  materialCode: string;
  warehouseCode: string;
  minQuantity: number | null;
  maxQuantity: number | null;
  safetyQuantity: number | null;
  reorderPoint: number | null;
  note: string;
  isActive: boolean;
  version?: number;
}
