import { Product } from '../../../../types';

export type MaterialFilter = {
  search?: string;
  category?: string;
  skus?: string[];
  sortOption?: 'name_asc' | 'name_desc' | 'sku_asc' | 'qty_desc' | 'price_desc';
};

export type MaterialFormData = Omit<Product, 'id'>;
