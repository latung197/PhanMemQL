// Sidebar menu: the module / group / item tree of mock/initialMenuData.ts, filtered by the user's rights.
// Items only name their function (subKey); routes and labels of functions live in config/functions.ts.
import { INITIAL_SYS_MODULES } from '../mock/initialMenuData';
import { TransformedModuleItem } from '../types/menu';
import { Language } from '../utils/i18n';
import { UserProfile } from '../types';
import { canView } from '../utils/permissions';
import { EMPTY_MENU_VISIBILITY, isMenuFunctionVisible, isMenuModuleVisible, type MenuVisibilityConfig } from './menuVisibility';

// Old versions kept a copy of the menu in the browser, which hid functions added later.
try { localStorage.removeItem('serp_sys_modules'); } catch { /* storage unavailable */ }

export const menuService = {
  /** Menu tree for the language, keeping only the items the user may view. */
  getUserMenuTree(
    lang: Language = 'vi',
    currentUser?: UserProfile,
    badgeCounts?: { lowStockCount?: number; pendingOrderCount?: number },
    visibility: MenuVisibilityConfig = EMPTY_MENU_VISIBILITY
  ): TransformedModuleItem[] {
    // Same rule as the screen guard in App (utils/permissions).
    const allowed = (item: { subKey: Parameters<typeof canView>[1] }) =>
      isMenuFunctionVisible(visibility, item.subKey) && (!currentUser || canView(currentUser, item.subKey));

    return INITIAL_SYS_MODULES
      .filter(m => m.isActive && isMenuModuleVisible(visibility, m.key))
      .sort((a, b) => a.orderNo - b.orderNo)
      .map(mod => {
        let badgeCount: number | undefined = undefined;
        if (mod.key === 'inventory') badgeCount = badgeCounts?.lowStockCount;
        if (mod.key === 'sales') badgeCount = badgeCounts?.pendingOrderCount;

        const subGroups = (mod.subGroups ?? [])
          .filter(g => g.isActive)
          .sort((a, b) => a.orderNo - b.orderNo)
          .map(group => ({
            groupTitle: lang === 'en' ? group.titleEn : group.titleVi,
            iconName: group.icon,
            iconColor: group.iconColor,
            items: group.items
              .filter(item => item.isActive && allowed(item))
              .sort((a, b) => a.orderNo - b.orderNo)
              .map(item => ({ subKey: item.subKey, label: lang === 'en' ? item.titleEn : item.titleVi, iconName: item.icon }))
          }))
          .filter(group => group.items.length > 0);

        return {
          key: mod.key,
          title: lang === 'en' ? mod.titleEn : mod.titleVi,
          iconName: mod.icon,
          badgeCount,
          subGroups
        };
      })
      // Modules without groups (overview, AI) have their own buttons in the sidebar.
      .filter(mod => mod.subGroups.length > 0);
  }
};
