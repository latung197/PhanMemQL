// Hash routes, derived from the function registry (config/functions.ts).
import { ModuleCategoryKey, SubMenuKey } from '../types';
import { FUNCTION_KEYS, FUNCTION_REGISTRY, findFunctionByPath } from './functions';

export interface RouteConfig {
  path: string;
  category: ModuleCategoryKey;
  subMenu: SubMenuKey;
  label: string;
}

const toRoute = (subMenu: SubMenuKey): RouteConfig => {
  const def = FUNCTION_REGISTRY[subMenu];
  return { path: def.path, category: def.category, subMenu, label: def.label };
};

export const ROUTE_MAP: RouteConfig[] = FUNCTION_KEYS.map(toRoute);

export const getRouteBySubMenu = (subMenu: SubMenuKey): RouteConfig =>
  toRoute(FUNCTION_REGISTRY[subMenu] ? subMenu : 'overview_main');

export const getRouteByHash = (hash: string): RouteConfig | undefined => {
  const key = findFunctionByPath(hash.replace(/^#/, '') || '/overview');
  return key ? toRoute(key) : undefined;
};
