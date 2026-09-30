import { useEffect, useRef } from 'react';
import { ModuleCategoryKey, SubMenuKey } from '../types';
import { getRouteByHash, getRouteBySubMenu } from '../config/router';

/**
 * Keeps the URL hash (#/settings/users) and the active screen in sync, both ways: navigating updates
 * the hash, and a typed URL, a reload or the browser back/forward buttons open the matching screen.
 */
export function useAppRouter(
  activeCategory: ModuleCategoryKey,
  activeSubMenu: SubMenuKey,
  onNavigate: (category: ModuleCategoryKey, subMenu: SubMenuKey) => void
) {
  // The hashchange listener is registered once, so it reads the current values through refs.
  const current = useRef({ activeCategory, activeSubMenu, onNavigate });
  current.current = { activeCategory, activeSubMenu, onNavigate };

  useEffect(() => {
    const handleHashChange = () => {
      const route = getRouteByHash(window.location.hash);
      const { activeCategory: category, activeSubMenu: subMenu, onNavigate: navigate } = current.current;
      if (!route) {
        // Unknown address: show the address of the current screen instead.
        window.location.replace(`#${getRouteBySubMenu(subMenu).path}`);
        return;
      }
      if (route.category !== category || route.subMenu !== subMenu) navigate(route.category, route.subMenu);
    };

    if (window.location.hash) handleHashChange();
    else window.location.replace(`#${getRouteBySubMenu(current.current.activeSubMenu).path}`);

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (category: ModuleCategoryKey, subMenu: SubMenuKey) => {
    onNavigate(category, subMenu);
    const path = `#${getRouteBySubMenu(subMenu).path}`;
    if (window.location.hash !== path) window.location.hash = path;
  };

  return { navigateTo };
}
