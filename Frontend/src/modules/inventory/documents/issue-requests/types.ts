import { GoodsVoucher } from '../../../../types';

export type IssueRequestFilter = {
  search?: string;
  status?: string;
  warehouseId?: string;
};

export type IssueRequestFormData = Partial<GoodsVoucher>;
