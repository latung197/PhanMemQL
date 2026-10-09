// Kho › Danh mục kho (backend /api/inventory/warehouses, function inv_warehouse_cat).
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { SaveWarehouseInput, WarehouseRecord } from './types';

export const warehousesApi = createCatalogApi<WarehouseRecord, SaveWarehouseInput>({
  url: '/api/inventory/warehouses', fileName: 'DanhMucKho'
});
