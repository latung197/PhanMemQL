import { INITIAL_SYS_MODULES } from '../mock/initialMenuData';
import { SysModule, TransformedModuleItem } from '../types/menu';
import { Language } from '../utils/i18n';
import { SubMenuKey, UserProfile } from '../types';
import { canView } from '../utils/permissions';

const STORAGE_KEY_SYS_MODULES = 'serp_sys_modules';

export interface SysCommandBackendDto {
  id: string;
  commandCode: string;
  commandName: string;
  commandNameEn: string;
  moduleCode: string;
  parentCode?: string;
  path: string;
  icon: string;
  orderNo: number;
  isVisible: boolean;
  isActive: boolean;
  badgeText?: string;
  actionType: string;
  children?: SysCommandBackendDto[];
}

/**
 * Menu Data Service: Synchronizes DB SysCommand / SysModule definitions between React & C# Backend
 */
export const menuService = {
  /**
   * Fetch dynamic commands directly from C# Backend REST API (/api/system/commands/tree)
   */
  async fetchCommandsFromBackend(): Promise<SysCommandBackendDto[]> {
    try {
      const res = await fetch('/api/system/commands/tree');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      console.warn('Backend REST API /api/system/commands unavailable, using client DB fallback:', err);
    }
    return [];
  },

  /**
   * Fetch raw SysModule records from Database (or localStorage cache)
   */
  getRawModulesFromDb(): SysModule[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SYS_MODULES);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse sys_modules from storage, falling back to seed data:', e);
    }
    localStorage.setItem(STORAGE_KEY_SYS_MODULES, JSON.stringify(INITIAL_SYS_MODULES));
    return INITIAL_SYS_MODULES;
  },

  /**
   * Save / Update raw SysModules in Database
   */
  saveModulesToDb(modules: SysModule[]): void {
    localStorage.setItem(STORAGE_KEY_SYS_MODULES, JSON.stringify(modules));
  },

  /**
   * Reset database menus back to system default seed data
   */
  resetToDefaultSeed(): SysModule[] {
    localStorage.setItem(STORAGE_KEY_SYS_MODULES, JSON.stringify(INITIAL_SYS_MODULES));
    return INITIAL_SYS_MODULES;
  },

  /**
   * Process and transform raw DB menu tree based on current Language & User Permissions.
   */
  getUserMenuTree(
    lang: Language = 'vi',
    currentUser?: UserProfile,
    badgeCounts?: { lowStockCount?: number; pendingOrderCount?: number }
  ): TransformedModuleItem[] {
    const modules = this.getRawModulesFromDb();

    // Same rule as the screen guard in App (utils/permissions).
    const hasPermission = (subKey?: string): boolean =>
      !subKey || !currentUser || canView(currentUser, subKey as SubMenuKey);

    return modules
      .filter(m => m.isActive)
      .sort((a, b) => a.orderNo - b.orderNo)
      .map(mod => {
        let badgeCount: number | undefined = undefined;
        if (mod.key === 'inventory') badgeCount = badgeCounts?.lowStockCount;
        if (mod.key === 'sales') badgeCount = badgeCounts?.pendingOrderCount;

        const title = lang === 'en' ? mod.titleEn : mod.titleVi;

        const transformedSubGroups = mod.subGroups
          ?.filter(g => g.isActive)
          .sort((a, b) => a.orderNo - b.orderNo)
          .map(group => {
            const groupTitle = lang === 'en' ? group.titleEn : group.titleVi;
            const validItems = group.items
              ?.filter(item => item.isActive && hasPermission(item.requiredPermission))
              .sort((a, b) => a.orderNo - b.orderNo)
              .map(item => ({
                subKey: item.subKey,
                label: lang === 'en' ? item.titleEn : item.titleVi,
                iconName: item.icon
              }));

            return {
              groupTitle,
              iconName: group.icon,
              iconColor: group.iconColor,
              items: validItems || []
            };
          })
          .filter(group => group.items.length > 0);

        return {
          key: mod.key,
          title,
          iconName: mod.icon,
          badgeCount,
          badgeColor: mod.badgeColor,
          subGroups: transformedSubGroups || []
        };
      })
      .filter(mod => mod.subGroups.length > 0);
  }
};
