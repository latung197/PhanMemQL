import type { ModuleCategoryKey, SubMenuKey } from '../types';
import { getFunction } from '../config/functions';

export interface MenuVisibilityConfig {
  hiddenModules: ModuleCategoryKey[];
  hiddenFunctions: SubMenuKey[];
}

export const EMPTY_MENU_VISIBILITY: MenuVisibilityConfig = { hiddenModules: [], hiddenFunctions: [] };

/** Navigation preference only. API access still follows the user's permissions. */
export const isMenuModuleVisible = (config: MenuVisibilityConfig, module: ModuleCategoryKey): boolean =>
  !config.hiddenModules.includes(module);

export const isMenuFunctionVisible = (config: MenuVisibilityConfig, functionCode: SubMenuKey): boolean =>
  isMenuModuleVisible(config, getFunction(functionCode).category)
  && !config.hiddenFunctions.includes(functionCode);
