import { ModuleCategoryKey, SubMenuKey } from '../types';
import { CATEGORY_NAMES, getFunction } from '../config/functions';

export interface NavHistoryItem {
  category: ModuleCategoryKey;
  subKey: SubMenuKey;
  label: string;
  moduleName: string;
  timestamp: number;
}

/** Category, label and module name of a function (from config/functions.ts). */
export function getSubMenuMeta(subKey: SubMenuKey) {
  const def = getFunction(subKey);
  return { category: def.category, label: def.label, moduleName: CATEGORY_NAMES[def.category] };
}
