// Product structures (backend: /api/production/product-structures): one structure per product, key = the material code of the product.
import { apiRequest } from '../../../services/apiClient';
import type { PagedResult } from '../../../services/paging';
import type { RecordStamp } from '../../../components/common/RecordStamp';

export interface ProductStructureListItem {
  materialCode: string;
  materialName: string;
  uomCode: string;
  lineCount: number;
  /** At least one component has a structure of its own. */
  hasChildren: boolean;
  isActive: boolean;
}

export interface ProductStructureLine {
  lineNo: number;
  componentMaterialCode: string;
  componentMaterialName?: string | null;
  uomCode: string;
  productionOperationCode?: string | null;
  productionOperationName?: string | null;
  quantity: number;
  scrapPercent: number;
  note?: string | null;
  /** The component has a structure of its own. */
  hasStructure: boolean;
}

export interface ProductStructure {
  materialCode: string;
  materialName: string;
  uomCode: string;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
  lines: ProductStructureLine[];
}

export interface SaveProductStructureLineInput {
  componentMaterialCode: string;
  quantity: number;
  uomCode: string;
  productionOperationCode: string;
  scrapPercent: number;
  note: string;
}

export interface SaveProductStructureInput {
  materialCode: string;
  lines: SaveProductStructureLineInput[];
  note: string;
  isActive: boolean;
  version?: number;
}

export interface ProductStructureQuery { page: number; pageSize: number; search?: string; mode?: 'exact' | 'parent' }

const base = '/api/production/product-structures';

export const productStructuresApi = {
  list: (query: ProductStructureQuery) => {
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
    if (query.search) params.set('search', query.search);
    if (query.mode === 'parent') params.set('mode', 'parent');
    return apiRequest<PagedResult<ProductStructureListItem>>('GET', `${base}?${params}`);
  },
  get: (materialCode: string) => apiRequest<ProductStructure>('GET', `${base}/${encodeURIComponent(materialCode)}`),
  create: (input: SaveProductStructureInput) => apiRequest<ProductStructure>('POST', base, input),
  update: (materialCode: string, input: SaveProductStructureInput) => apiRequest<ProductStructure>('PUT', `${base}/${encodeURIComponent(materialCode)}`, input),
  remove: (materialCode: string) => apiRequest<void>('DELETE', `${base}/${encodeURIComponent(materialCode)}`)
};
