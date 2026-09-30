import { UomConversion } from '../../../types';

export type UomConversionFilter = {
  search?: string;
  materialId?: string;
};

export type UomConversionFormData = Partial<UomConversion>;
