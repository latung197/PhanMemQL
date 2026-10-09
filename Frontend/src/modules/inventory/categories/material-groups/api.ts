// Kho › Danh mục nhóm vật tư (backend /api/inventory/material-groups, function inv_material_group_cat).
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { MaterialGroupRecord, SaveMaterialGroupInput } from './types';

export const materialGroupsApi = createCatalogApi<MaterialGroupRecord, SaveMaterialGroupInput>({
  url: '/api/inventory/material-groups', fileName: 'DanhMucNhomVatTu'
});
