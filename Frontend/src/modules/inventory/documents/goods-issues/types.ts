import { GoodsVoucher } from '../../../../types';

export type GoodsIssueFilter = {
  search?: string;
  warehouseId?: string;
};

export type GoodsIssueFormData = Partial<GoodsVoucher>;
