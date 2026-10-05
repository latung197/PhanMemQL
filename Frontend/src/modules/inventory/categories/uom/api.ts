// Kho › Danh mục đơn vị tính (backend /api/inventory/uoms, function inv_uom_cat).
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { SaveUomInput, Uom } from './types';

export const uomsApi = createCatalogApi<Uom, SaveUomInput>({ url: '/api/inventory/uoms', fileName: 'DanhMucDonViTinh' });
