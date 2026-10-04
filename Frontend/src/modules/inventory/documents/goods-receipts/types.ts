import { GoodsVoucher } from '../../../../types';

export type GoodsReceiptFilter = {
  search?: string;
  status?: string;
  warehouseId?: string;
};

export type GoodsReceiptFormData = Partial<GoodsVoucher>;
