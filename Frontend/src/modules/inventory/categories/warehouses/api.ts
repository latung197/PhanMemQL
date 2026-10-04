import { apiRequest } from '../../../../services/apiClient';
import type { CatalogScreenApi, DeleteManyResult, ImportMode, ImportResult } from '../../../../components/catalog/catalogTypes';
import type { WarehouseRecord, SaveWarehouseInput } from './types';

const url = '/api/inventory/warehouses';

export const warehousesApi: CatalogScreenApi<WarehouseRecord, SaveWarehouseInput> = {
  getAll: () => apiRequest<WarehouseRecord[]>('GET', url),
  create: input => apiRequest<WarehouseRecord>('POST', url, input),
  update: (code, input) => apiRequest<WarehouseRecord>('PUT', `${url}/${encodeURIComponent(code)}`, input),
  remove: code => apiRequest<void>('DELETE', `${url}/${encodeURIComponent(code)}`),
  importMany: (rows, mode: ImportMode) => apiRequest<ImportResult>('POST', `${url}/import`, { rows, mode }),
  removeMany: keys => apiRequest<DeleteManyResult>('POST', `${url}/delete-many`, { keys })
};
