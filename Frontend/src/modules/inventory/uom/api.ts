// Kho › Danh mục đơn vị tính (backend /api/inventory/uoms, function inv_uom_cat).
import { apiRequest } from '../../../services/apiClient';
import type { CatalogScreenApi, DeleteManyResult, ImportMode, ImportResult } from '../../../components/catalog/catalogTypes';
import { SaveUomInput, Uom } from './types';

export const uomsApi: CatalogScreenApi<Uom, SaveUomInput> = {
  /** Full catalog: needs the view right. Other screens pick units with CatalogLookup lookup="uoms". */
  getAll: () => apiRequest<Uom[]>('GET', '/api/inventory/uoms'),
  create: (input: SaveUomInput) => apiRequest<Uom>('POST', '/api/inventory/uoms', input),
  update: (code: string, input: SaveUomInput) => apiRequest<Uom>('PUT', `/api/inventory/uoms/${encodeURIComponent(code)}`, input),
  remove: (code: string) => apiRequest<void>('DELETE', `/api/inventory/uoms/${encodeURIComponent(code)}`),
  /** Nhập Excel: all rows saved or none; errors by row. */
  importMany: (rows: SaveUomInput[], mode: ImportMode) => apiRequest<ImportResult>('POST', '/api/inventory/uoms/import', { rows, mode }),
  removeMany: (keys: string[]) => apiRequest<DeleteManyResult>('POST', '/api/inventory/uoms/delete-many', { keys })
};
