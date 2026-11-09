// Kho › Định mức tồn kho (backend /api/inventory/stock-norms, function inv_stock_norm_cat).
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { SaveStockNormInput, StockNormRecord } from './types';

export const stockNormsApi = createCatalogApi<StockNormRecord, SaveStockNormInput>({ url: '/api/inventory/stock-norms', fileName: 'DinhMucTonKho' });
