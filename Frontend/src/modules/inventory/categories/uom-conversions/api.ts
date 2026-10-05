// Kho › Danh mục quy đổi đơn vị tính (backend /api/inventory/uom-conversions, function inv_uom_conversion_cat).
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { SaveUomConversionInput, UomConversionRecord } from './types';

export const uomConversionsApi = createCatalogApi<UomConversionRecord, SaveUomConversionInput>({
  url: '/api/inventory/uom-conversions', fileName: 'DanhMucQuyDoiDonViTinh'
});
