// Kho › Danh mục loại kho (backend /api/inventory/warehouse-types, function inv_warehouse_type_cat).
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { SaveWarehouseTypeInput, WarehouseTypeRecord } from './types';

export const warehouseTypesApi = createCatalogApi<WarehouseTypeRecord, SaveWarehouseTypeInput>({
  url: '/api/inventory/warehouse-types', fileName: 'DanhMucLoaiKho'
});
