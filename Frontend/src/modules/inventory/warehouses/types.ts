import { Warehouse } from '../../../types';

export type WarehouseFilter = {
  search?: string;
  status?: string;
  sortOption?: 'name_asc' | 'name_desc' | 'code_asc';
};

export type WarehouseFormData = Partial<Warehouse>;
