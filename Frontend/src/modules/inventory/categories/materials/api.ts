// Kho › Danh mục vật tư (backend /api/inventory/materials, function inv_material_cat).
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { MaterialRecord, SaveMaterialInput } from './types';

export const materialsApi = createCatalogApi<MaterialRecord, SaveMaterialInput>({
  url: '/api/inventory/materials', fileName: 'DanhMucVatTu'
});
