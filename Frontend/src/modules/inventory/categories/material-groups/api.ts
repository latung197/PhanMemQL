import { apiRequest } from '../../../../services/apiClient';
import type { CatalogScreenApi, DeleteManyResult, ImportMode, ImportResult } from '../../../../components/catalog/catalogTypes';
import type { MaterialGroupRecord, SaveMaterialGroupInput } from './types';

const url = '/api/inventory/material-groups';

export const materialGroupsApi: CatalogScreenApi<MaterialGroupRecord, SaveMaterialGroupInput> = {
  getAll: () => apiRequest<MaterialGroupRecord[]>('GET', url),
  create: input => apiRequest<MaterialGroupRecord>('POST', url, input),
  update: (code, input) => apiRequest<MaterialGroupRecord>('PUT', `${url}/${encodeURIComponent(code)}`, input),
  remove: code => apiRequest<void>('DELETE', `${url}/${encodeURIComponent(code)}`),
  importMany: (rows, mode: ImportMode) => apiRequest<ImportResult>('POST', `${url}/import`, { rows, mode }),
  removeMany: keys => apiRequest<DeleteManyResult>('POST', `${url}/delete-many`, { keys })
};
