import { StorageLocation } from '../../../../types';

export type LocationFilter = {
  search?: string;
  zone?: string;
  status?: string;
};

export type LocationFormData = Partial<StorageLocation>;
