import { apiRequest } from '../../../../services/apiClient';
import type { CatalogScreenApi, DeleteManyResult, ImportMode, ImportResult } from '../../../../components/catalog/catalogTypes';
import type { SaveUomConversionInput, UomConversionRecord } from './types';

const url = '/api/inventory/uom-conversions';

export const uomConversionsApi: CatalogScreenApi<UomConversionRecord, SaveUomConversionInput> = {
  getAll: () => apiRequest<UomConversionRecord[]>('GET', url),
  create: input => apiRequest<UomConversionRecord>('POST', url, input),
  update: (code, input) => apiRequest<UomConversionRecord>('PUT', `${url}/${encodeURIComponent(code)}`, input),
  remove: code => apiRequest<void>('DELETE', `${url}/${encodeURIComponent(code)}`),
  importMany: (rows, mode: ImportMode) => apiRequest<ImportResult>('POST', `${url}/import`, { rows, mode }),
  removeMany: keys => apiRequest<DeleteManyResult>('POST', `${url}/delete-many`, { keys })
};
