import { MaterialLot } from '../../../../types';

export type LotFilter = {
  search?: string;
  qualityStatus?: string;
};

export type LotFormData = Partial<MaterialLot>;
