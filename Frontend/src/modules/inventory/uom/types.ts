import { UnitOfMeasure } from '../../../types';

export type UomFilter = {
  search?: string;
  status?: string;
};

export type UomFormData = Partial<UnitOfMeasure>;
