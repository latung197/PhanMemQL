// Kho › Lô và hạn sử dụng (backend /api/inventory/lots, function inv_lot_cat).
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { LotRecord, SaveLotInput } from './types';

export const lotsApi = createCatalogApi<LotRecord, SaveLotInput>({ url: '/api/inventory/lots', fileName: 'DanhMucLo' });
