import { StockNorm } from '../../../../types';

export type StockNormFilter = {
  search?: string;
  status?: string;
};

export type StockNormFormData = Partial<StockNorm>;
