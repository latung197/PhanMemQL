// Menu hierarchy and titles come from sys_command. Routes and screen components remain registered in frontend code.
import { apiRequest } from './apiClient';
import { FUNCTION_REGISTRY, CATEGORY_NAMES } from '../config/functions';
import type { ModuleCategoryKey, SubMenuKey, UserProfile } from '../types';
import type { SysModule, SysMenuGroup, SysMenuItem, TransformedModuleItem } from '../types/menu';
import type { Language } from '../utils/i18n';
import { canView } from '../utils/permissions';
import { EMPTY_MENU_VISIBILITY, isMenuFunctionVisible, isMenuModuleVisible, type MenuVisibilityConfig } from './menuVisibility';

interface MenuNode {
  id: string;
  parentId: string | null;
  nodeType: 'module' | 'group' | 'function';
  code: string;
  titleVi: string;
  titleEn: string;
  titles: Record<string, string>;
  icon: string;
  iconColor: string | null;
  badgeType: string | null;
  directFunctionCode: string | null;
  orderNo: number;
  isActive: boolean;
}

const knownFunction = (code: string): code is SubMenuKey => Object.hasOwn(FUNCTION_REGISTRY, code);
const knownModule = (code: string): code is ModuleCategoryKey => Object.hasOwn(CATEGORY_NAMES, code);

/** A new language adds sys_command_translation rows, without changing the menu schema. */
export const menuTitle = (item: { titleVi: string; titleEn: string; titles?: Record<string, string> }, lang: Language): string => {
  const code = lang.toLowerCase();
  const translated = item.titles?.[code] ?? item.titles?.[code.split('-')[0]];
  return translated?.trim() || (code.startsWith('en') ? item.titleEn?.trim() : '') || item.titleVi;
};

const toTree = (nodes: MenuNode[]): SysModule[] => {
  const ordered = [...nodes].sort((a, b) => a.orderNo - b.orderNo || a.id.localeCompare(b.id));
  const modules = ordered.filter(n => n.nodeType === 'module' && knownModule(n.code));
  return modules.map(mod => {
    const groups: SysMenuGroup[] = ordered.filter(n => n.nodeType === 'group' && n.parentId === mod.id).map(group => ({
      id: group.id, groupCode: group.code, titleVi: group.titleVi, titleEn: group.titleEn, titles: group.titles,
      icon: group.icon, iconColor: group.iconColor ?? undefined, orderNo: group.orderNo, isActive: group.isActive,
      items: ordered.filter(n => n.nodeType === 'function' && n.parentId === group.id && knownFunction(n.code))
        .map((item): SysMenuItem => ({
          id: item.id, subKey: item.code as SubMenuKey, titleVi: item.titleVi, titleEn: item.titleEn, titles: item.titles,
          icon: item.icon, orderNo: item.orderNo, isActive: item.isActive,
          badgeType: item.badgeType === 'lowStock' || item.badgeType === 'pendingOrder' ? item.badgeType : undefined
        }))
    }));
    return {
      id: mod.id, key: mod.code as ModuleCategoryKey, titleVi: mod.titleVi, titleEn: mod.titleEn, titles: mod.titles,
      icon: mod.icon, orderNo: mod.orderNo, isActive: mod.isActive,
      directSubKey: mod.directFunctionCode && knownFunction(mod.directFunctionCode) ? mod.directFunctionCode : undefined,
      subGroups: groups
    };
  });
};

export const menuService = {
  load: async (): Promise<SysModule[]> => toTree(await apiRequest<MenuNode[]>('GET', '/api/menu')),

  getUserMenuTree(
    tree: SysModule[], lang: Language = 'vi', currentUser?: UserProfile,
    badgeCounts?: { lowStockCount?: number; pendingOrderCount?: number },
    visibility: MenuVisibilityConfig = EMPTY_MENU_VISIBILITY
  ): TransformedModuleItem[] {
    const allowed = (item: { subKey: SubMenuKey }) =>
      isMenuFunctionVisible(visibility, item.subKey) && (!currentUser || canView(currentUser, item.subKey));

    return tree.filter(m => m.isActive && isMenuModuleVisible(visibility, m.key))
      .sort((a, b) => a.orderNo - b.orderNo)
      .map(mod => {
        const badgeCount = mod.key === 'inventory' ? badgeCounts?.lowStockCount
          : mod.key === 'sales' ? badgeCounts?.pendingOrderCount : undefined;
        const subGroups = (mod.subGroups ?? []).filter(g => g.isActive).sort((a, b) => a.orderNo - b.orderNo)
          .map(group => ({
            groupTitle: menuTitle(group, lang),
            iconName: group.icon, iconColor: group.iconColor,
            items: group.items.filter(item => item.isActive && allowed(item))
              .sort((a, b) => a.orderNo - b.orderNo)
              .map(item => ({ subKey: item.subKey, label: menuTitle(item, lang), iconName: item.icon }))
          })).filter(group => group.items.length > 0);
        return { key: mod.key, title: menuTitle(mod, lang),
          iconName: mod.icon, badgeCount, directSubKey: mod.directSubKey, subGroups };
      }).filter(mod => mod.subGroups.length > 0);
  }
};
