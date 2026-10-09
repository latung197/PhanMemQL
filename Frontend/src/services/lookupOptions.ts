// Lists that other screens need from catalogs they have no right to open: read through the lookups (open to every
// signed-in user, cached on the server), never through the catalog's own list (that needs its View right).
import { lookupApi, type LookupItem } from '../components/catalog/CatalogLookup';
import type { CompanyUnit, MaterialType } from '../types';
import type { Currency, DepartmentOption } from './settingsApi';

const PAGE = 200;
const all = async (lookup: string): Promise<LookupItem[]> => (await lookupApi.search(lookup, '', 1, PAGE, true)).items;
/** The screens still on browser data keep their status as text. */
const legacyStatus = (active: boolean): 'Hoạt động' | 'Tạm dừng' => (active ? 'Hoạt động' : 'Tạm dừng');
const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export const loadDepartmentOptions = async (): Promise<DepartmentOption[]> =>
  (await all('departments')).map(x => ({ code: x.code, name: x.name, isActive: x.isActive }));

export const loadCurrencyOptions = async (): Promise<Currency[]> =>
  (await all('currencies')).map(x => ({
    code: x.code, name: x.name, isActive: x.isActive, symbol: text(x.extra.symbol),
    decimalPlaces: Number(x.extra.decimalPlaces ?? 0), isBase: text(x.extra.isBase) === '1' || x.extra.isBase === true
  }));

/** Units for the header picker and the forms: names follow the language of the session. */
export const loadCompanyUnits = async (): Promise<CompanyUnit[]> =>
  (await all('companyUnits')).map(x => ({
    id: x.code, code: x.code, name: x.name, localizedName: x.name, shortName: text(x.extra.shortName) || undefined,
    isActive: x.isActive, status: legacyStatus(x.isActive),
    isDefault: text(x.extra.isDefault) === '1' || x.extra.isDefault === true
  }));

/** Material types for pickers (the materials screen still on browser data): the group text comes as the extra column. */
export const loadMaterialTypeOptions = async (): Promise<MaterialType[]> =>
  (await all('materialTypes')).map(x => ({
    id: x.code, code: x.code, name: x.name, group: text(x.extra.groupName), description: '',
    status: legacyStatus(x.isActive)
  }));
