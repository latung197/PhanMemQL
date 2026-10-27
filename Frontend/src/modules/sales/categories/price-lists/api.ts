import { apiRequest } from '../../../../services/apiClient';
import { createCatalogApi } from '../../../../components/catalog/createCatalogApi';
import type { PriceListLine, PriceListRecord, SavePriceListInput } from './types';

const url = '/api/sales/price-lists';

/** The price a customer pays for a material in a unit on a day (GET .../resolve); null when no price list gives one. */
export interface ResolvedPrice {
  priceListCode: string;
  priceListName: string;
  currencyCode: string;
  uomCode: string;
  minQuantity: number;
  unitPrice: number;
}

export const priceListsApi = {
  ...createCatalogApi<PriceListRecord, SavePriceListInput>({ url, fileName: 'DanhMucBangGiaBan' }),
  /** The lines of one price list (the form reads them when it opens). */
  getLines: (code: string) => apiRequest<PriceListLine[]>('GET', `${url}/${encodeURIComponent(code)}/lines`),
  /** Needs the View right of the price list: a user without it gets an error (callers ignore it and let the price be typed). */
  resolve: async (query: { customer?: string; material: string; uom: string; currency: string; date?: string; quantity?: number }) => {
    const params = new URLSearchParams({ material: query.material, uom: query.uom, currency: query.currency });
    if (query.customer) params.set('customer', query.customer);
    if (query.date) params.set('date', query.date);
    if (query.quantity) params.set('quantity', String(query.quantity));
    return (await apiRequest<ResolvedPrice | null | undefined>('GET', `${url}/resolve?${params}`)) ?? null;
  }
};
