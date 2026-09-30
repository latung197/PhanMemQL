import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Sparkles,
  Lock,
  X,
  Bot
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { ModuleCategoryKey, SubMenuKey, UserProfile } from '../../types';
import { DynamicIcon } from '../common/DynamicIcon';
import { menuService } from '../../services/menuService';
import { canView } from '../../utils/permissions';

interface SidebarProps {
  activeCategory: ModuleCategoryKey;
  activeSubMenu: SubMenuKey;
  currentUser?: UserProfile | null;
  onSelectSubMenu: (category: ModuleCategoryKey, subMenu: SubMenuKey) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  lowStockCount: number;
  pendingOrderCount: number;
}

interface ModuleMenuItem {
  key: ModuleCategoryKey;
  title: string;
  icon: React.ReactNode;
  badgeCount?: number;
  subGroups?: {
    groupTitle: string;
    icon: React.ReactNode;
    items: {
      subKey: SubMenuKey;
      label: string;
      icon?: React.ReactNode;
    }[];
  }[];
  directSubKey?: SubMenuKey;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeCategory,
  activeSubMenu,
  currentUser,
  onSelectSubMenu,
  mobileOpen,
  onCloseMobile,
  lowStockCount,
  pendingOrderCount
}) => {
  const { language, t } = useLanguage();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    inventory: true,
    sales: true,
    finance: false,
    hr: false
  });

  // State for collapsible sub-function groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const isSubKeyVisible = (subKey: SubMenuKey): boolean => canView(currentUser, subKey);

  const toggleModuleExpand = (modKey: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [modKey]: !prev[modKey]
    }));
  };

  const isGroupOpen = (modKey: string, groupTitle: string) => {
    const key = `${modKey}_${groupTitle}`;
    return expandedGroups[key] ?? true; // Default to open
  };

  const toggleGroupExpand = (modKey: string, groupTitle: string) => {
    const key = `${modKey}_${groupTitle}`;
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !(prev[key] ?? true)
    }));
  };

  // Load menu structure dynamically from database/mock service (C# API response format)
  const menuConfig = menuService.getUserMenuTree(
    language,
    currentUser || undefined,
    { lowStockCount, pendingOrderCount }
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-40 md:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
        ></div>
      )}

      {/* Main Sidebar Shell */}
      <aside
        className={`
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0 transition-all duration-300 ease-in-out
          fixed md:static inset-y-0 left-0 z-50 bg-brand-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 flex flex-col justify-between shrink-0 border-r border-brand-200 dark:border-slate-800 shadow-xl md:shadow-none
          ${isCollapsed ? 'w-20' : 'w-68'}
        `}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-brand-200 dark:border-slate-800 bg-brand-100/80 dark:bg-slate-900/60 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onSelectSubMenu('overview', 'overview_main');
              onCloseMobile();
            }}
            className="flex items-center gap-3 overflow-hidden cursor-pointer rounded-[7px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            aria-label="Về Dashboard"
            title="Về Dashboard"
          >
            <span className="h-9 w-9 bg-indigo-600 text-white rounded-[7px] flex items-center justify-center font-extrabold text-sm tracking-wider shrink-0 shadow-md ring-2 ring-indigo-400/30">
              S
            </span>
            {!isCollapsed && (
              <div className="animate-fade-in truncate">
                <h2 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight leading-none mb-1">
                  S-ERP System
                </h2>
                <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 tracking-wider">
                  Doanh Nghiệp ERP
                </span>
              </div>
            )}
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-brand-100 dark:hover:bg-slate-800 rounded-[5px] transition-colors cursor-pointer"
            title={isCollapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')}
          >
            {isCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Hierarchical Navigation Menu */}
        <nav className="p-3 grow space-y-1.5 overflow-y-auto custom-scrollbar">
          {menuConfig.map((mod) => {
            const isCatActive = activeCategory === mod.key;
            const isExpanded = expandedModules[mod.key] ?? false;
            const hasSubGroups = mod.subGroups && mod.subGroups.length > 0;

            if (isCollapsed) {
              // Collapsed mode icons only
              return (
                <button
                  key={mod.key}
                  onClick={() => {
                    if (mod.directSubKey) {
                      onSelectSubMenu(mod.key, mod.directSubKey);
                    } else if (mod.subGroups && mod.subGroups[0]?.items[0]) {
                      onSelectSubMenu(mod.key, mod.subGroups[0].items[0].subKey);
                    }
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-center p-3 rounded-[5px] transition-all cursor-pointer relative ${
                    isCatActive ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-brand-100 dark:hover:bg-slate-800 hover:text-indigo-950 dark:hover:text-white'
                  }`}
                  title={mod.title}
                >
                  <DynamicIcon name={mod.iconName} className="h-4.5 w-4.5" />
                  {mod.badgeCount && mod.badgeCount > 0 ? (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500"></span>
                  ) : null}
                </button>
              );
            }

            return (
              <div key={mod.key} className="space-y-1">
                {/* Module Header Button */}
                <button
                  onClick={() => {
                    if (hasSubGroups) {
                      toggleModuleExpand(mod.key);
                    } else if (mod.directSubKey) {
                      onSelectSubMenu(mod.key, mod.directSubKey);
                      onCloseMobile();
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[5px] text-left text-xs font-bold transition-all cursor-pointer focus:outline-hidden ${
                    isCatActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-brand-100 dark:hover:bg-slate-800 hover:text-indigo-950 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <DynamicIcon name={mod.iconName} className="h-4.5 w-4.5" />
                    <span>{mod.title}</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    {mod.badgeCount && mod.badgeCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500 text-white">
                        {mod.badgeCount}
                      </span>
                    ) : null}
                    {hasSubGroups && (
                      <span className={isCatActive ? 'text-indigo-200' : 'text-slate-400'}>
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </span>
                    )}
                  </div>
                </button>

                {/* Sub Groups Accordion (Hierarchical levels) */}
                {hasSubGroups && isExpanded && (
                  <div className="pl-2.5 pr-1 py-1 space-y-1.5 border-l-2 border-brand-200 dark:border-slate-800 ml-3.5 my-1 animate-fade-in bg-brand-100/60 dark:bg-slate-900/30 rounded-r-[7px]">
                    {mod.subGroups!.map((group, gIdx) => {
                      const groupExpanded = isGroupOpen(mod.key, group.groupTitle);
                      const visibleItems = group.items.filter((subItem) => isSubKeyVisible(subItem.subKey));

                      if (visibleItems.length === 0) return null;

                      return (
                        <div key={gIdx} className="space-y-1">
                          {/* SubGroup Header Toggle Button */}
                          <button
                            type="button"
                            onClick={() => toggleGroupExpand(mod.key, group.groupTitle)}
                            className="w-full flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-300 pt-1.5 pb-1 px-2 rounded-[5px] hover:bg-brand-100 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group/sub"
                          >
                            <span className="flex items-center gap-1.5">
                              <DynamicIcon name={group.iconName} className={`h-3.5 w-3.5 ${group.iconColor || 'text-indigo-600 dark:text-indigo-400'}`} />
                              <span>{group.groupTitle}</span>
                              <span className="text-[9px] font-normal text-slate-400 dark:text-slate-500 opacity-80">
                                ({visibleItems.length})
                              </span>
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 group-hover/sub:text-indigo-600 dark:group-hover/sub:text-indigo-300 transition-colors">
                              {groupExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </span>
                          </button>

                          {/* SubGroup Leaf Links */}
                          {groupExpanded && (
                            <div className="space-y-0.5 animate-fade-in">
                              {visibleItems.map((subItem) => {
                                const isSubActive = activeSubMenu === subItem.subKey;

                                return (
                                  <button
                                    key={subItem.subKey}
                                    onClick={() => {
                                      onSelectSubMenu(mod.key, subItem.subKey);
                                      onCloseMobile();
                                    }}
                                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[5px] text-xs font-medium transition-all text-left cursor-pointer ${
                                      isSubActive
                                        ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-indigo-950 dark:hover:text-slate-200 hover:bg-brand-100 dark:hover:bg-slate-800/60'
                                    }`}
                                  >
                                    <span className="flex items-center gap-2 min-w-0 truncate">
                                      <DynamicIcon name={subItem.iconName} className={`h-3.5 w-3.5 ${isSubActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                                      <span className="truncate">{subItem.label}</span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>


        {/* AI Quick Footer Link */}
        {!isCollapsed && (
          <div className="p-3 border-t border-brand-200 dark:border-slate-800 bg-brand-100/70 dark:bg-slate-950/40">
            <button
              onClick={() => {
                onSelectSubMenu('ai', 'ai_main');
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-[7px] text-left text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white transition-colors cursor-pointer"
            >
              <Bot className="h-4 w-4 animate-pulse text-amber-300" />
              <div className="grow truncate">
                <p className="font-bold flex items-center gap-1 text-[11px]">
                  {t('navigation.aiAdvisor')}
                  <Sparkles className="h-3 w-3 text-amber-300" />
                </p>
                <p className="text-[9.5px] text-indigo-200 font-normal">{t('navigation.aiSubtext')}</p>
              </div>
            </button>
          </div>
        )}

      </aside>
    </>
  );
};
