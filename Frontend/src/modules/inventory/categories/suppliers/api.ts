import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { SaveSupplierInput, SupplierRecord } from './types';

export const suppliersApi = createCatalogApi<SupplierRecord, SaveSupplierInput>({
  url: '/api/inventory/suppliers', fileName: 'DanhMucNhaCungCap'
});
