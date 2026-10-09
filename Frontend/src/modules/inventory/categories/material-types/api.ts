// Kho › Danh mục loại vật tư (backend /api/inventory/material-types, function inv_material_type_cat).
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { MaterialTypeRecord, SaveMaterialTypeInput } from './types';

export const materialTypesApi = createCatalogApi<MaterialTypeRecord, SaveMaterialTypeInput>({
  url: '/api/inventory/material-types', fileName: 'DanhMucLoaiVatTu'
});
