// Kho › Danh mục đơn vị tính (backend /api/inventory/uoms, function inv_uom_cat).
import { apiRequest } from '../../../services/apiClient';
import { SaveUomInput, Uom } from './types';

export const uomsApi = {
  /** Every signed-in user may read it (pickers of materials, conversions and voucher lines). */
  getAll: () => apiRequest<Uom[]>('GET', '/api/inventory/uoms'),
  create: (input: SaveUomInput) => apiRequest<Uom>('POST', '/api/inventory/uoms', input),
  update: (code: string, input: SaveUomInput) => apiRequest<Uom>('PUT', `/api/inventory/uoms/${encodeURIComponent(code)}`, input),
  remove: (code: string) => apiRequest<void>('DELETE', `/api/inventory/uoms/${encodeURIComponent(code)}`)
};
