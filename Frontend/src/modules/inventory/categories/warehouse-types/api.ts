import { apiRequest } from '../../../../services/apiClient';
import type { CatalogScreenApi, DeleteManyResult, ImportMode, ImportResult } from '../../../../components/catalog/catalogTypes';
import type { SaveWarehouseTypeInput, WarehouseTypeRecord } from './types';

const url = '/api/inventory/warehouse-types';

export const warehouseTypesApi: CatalogScreenApi<WarehouseTypeRecord, SaveWarehouseTypeInput> = {
  getAll: () => apiRequest<WarehouseTypeRecord[]>('GET', url),
  create: input => apiRequest<WarehouseTypeRecord>('POST', url, input),
  update: (code, input) => apiRequest<WarehouseTypeRecord>('PUT', `${url}/${encodeURIComponent(code)}`, input),
  remove: code => apiRequest<void>('DELETE', `${url}/${encodeURIComponent(code)}`),
  importMany: (rows, mode: ImportMode) => apiRequest<ImportResult>('POST', `${url}/import`, { rows, mode }),
  removeMany: keys => apiRequest<DeleteManyResult>('POST', `${url}/delete-many`, { keys })
};
