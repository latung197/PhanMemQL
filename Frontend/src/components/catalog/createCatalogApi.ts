// The api of a catalog screen, written once: the endpoints every catalog controller has (CatalogControllerBase on the
// backend). A catalog only gives its URL and the base name of its exported file:
//   export const uomsApi = createCatalogApi<Uom, SaveUomInput>({ url: '/api/inventory/uoms', fileName: 'DanhMucDonViTinh' });
import { apiDownload, apiRequest } from '../../services/apiClient';
import { pagedQueryString, type PagedQuery, type PagedResult } from '../../services/paging';
import type { CatalogScreenApi, CodeChangePreview, DeleteManyResult, ImportMode, ImportResult } from './catalogTypes';

const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

export function createCatalogApi<T, TInput>(options: {
  /** Base URL of the catalog's controller, e.g. '/api/inventory/uoms'. */
  url: string;
  /** Base name of the exported file, without date or extension. */
  fileName: string;
}): CatalogScreenApi<T, TInput> {
  const { url, fileName } = options;
  const item = (key: string) => `${url}/${encodeURIComponent(key)}`;
  return {
    /** One page, sorted and filtered by the server (needs the view right). Other screens pick codes with CatalogLookup. */
    list: (query: PagedQuery) => apiRequest<PagedResult<T>>('GET', `${url}${pagedQueryString(query)}`),
    /** Excel file of every row the filters match (needs the view and export rights). */
    exportAll: (query: PagedQuery) => apiDownload(`${url}/export${pagedQueryString(query, false)}`, `${fileName}_${today()}.xlsx`),
    create: (input: TInput) => apiRequest<T>('POST', url, input),
    update: (key: string, input: TInput) => apiRequest<T>('PUT', item(key), input),
    remove: (key: string) => apiRequest<void>('DELETE', item(key)),
    /** Nhập Excel: all rows saved or none; errors by row. */
    importMany: (rows: TInput[], mode: ImportMode) => apiRequest<ImportResult>('POST', `${url}/import`, { rows, mode }),
    removeMany: (keys: string[]) => apiRequest<DeleteManyResult>('POST', `${url}/delete-many`, { keys }),
    /** Đổi mã / gộp mã: needs Edit and the special right CHANGE_CODE; the catalog must allow it. */
    codeChange: {
      preview: (key: string, into?: string) =>
        apiRequest<CodeChangePreview>('GET', `${item(key)}/code-change${into ? `?into=${encodeURIComponent(into)}` : ''}`),
      rename: (key: string, newCode: string, version?: number) => apiRequest<T>('POST', `${item(key)}/rename`, { newCode, version }),
      merge: (key: string, into: string) => apiRequest<T>('POST', `${item(key)}/merge`, { intoCode: into })
    }
  };
}
