import { MaterialType } from '../../../types';

export type MaterialTypeFilter = {
  search?: string;
  group?: string;
};

export type MaterialTypeFormData = Partial<MaterialType>;
