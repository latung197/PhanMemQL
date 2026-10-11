// Kho › Danh mục vị trí lưu kho (backend /api/inventory/locations, function inv_location_cat).
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { SaveStorageLocationInput, StorageLocationRecord } from './types';

export const locationsApi = createCatalogApi<StorageLocationRecord, SaveStorageLocationInput>({
  url: '/api/inventory/locations', fileName: 'DanhMucViTriLuuKho'
});
