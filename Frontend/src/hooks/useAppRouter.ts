import { useEffect } from 'react';
import { ModuleCategoryKey, SubMenuKey } from '../types';
import { getRouteByHash, getRouteBySubMenu } from '../config/router';

export function useAppRouter(
  activeCategory: ModuleCategoryKey,
  activeSubMenu: SubMenuKey,
  onNavigate: (category: ModuleCategoryKey, subMenu: SubMenuKey) => void
) {
  // Synchronize hash on initial load & popstate (browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        const route = getRouteByHash(hash);
        if (route && (route.category !== activeCategory || route.subMenu !== activeSubMenu)) {
          onNavigate(route.category, route.subMenu);
        }
      }
    };

    // On mount check current hash
    if (window.location.hash) {
      handleHashChange();
    } else {
      // Set initial hash
      const defaultRoute = getRouteBySubMenu(activeSubMenu);
      window.location.hash = defaultRoute.path;
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update hash whenever activeSubMenu changes
  const navigateTo = (category: ModuleCategoryKey, subMenu: SubMenuKey) => {
    const route = getRouteBySubMenu(subMenu);
    if (window.location.hash !== `#${route.path}`) {
      window.location.hash = route.path;
    }
    onNavigate(category, subMenu);
  };

  return { navigateTo };
}
