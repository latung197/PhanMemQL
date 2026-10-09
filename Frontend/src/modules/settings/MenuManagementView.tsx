import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Save } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Tabs } from '../../components/common/Tabs';
import { MenuStructureEditor } from './MenuStructureEditor';
import { Checkbox } from '../../components/common/Checkbox';
import { useLanguage } from '../../context/LanguageContext';
import type { SysModule } from '../../types/menu';
import { menuService, menuTitle } from '../../services/menuService';
import type { ModuleCategoryKey, SubMenuKey } from '../../types';
import type { MenuVisibilityConfig } from '../../services/menuVisibility';
import { systemSettingsService } from '../../services/systemSettingsService';
import { getErrorMessage } from '../../services/apiClient';
import { showToast } from '../../utils/toast';

type MenuTab = 'visibility' | 'structure';

const protectedModules: ModuleCategoryKey[] = ['overview', 'settings'];
const protectedFunctions: SubMenuKey[] = ['overview_main', 'sys_menu'];

export const MenuManagementView: React.FC<{
  canEdit: boolean;
  visibility: MenuVisibilityConfig;
  menuTree: SysModule[];
  onSaved: (value: MenuVisibilityConfig) => void;
  onStructureChanged: () => void;
}> = ({ canEdit, visibility, menuTree, onSaved, onStructureChanged }) => {
  const { language, t } = useLanguage();
  const [draft, setDraft] = useState<MenuVisibilityConfig>(visibility);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  // Structure changes belong to the super administrator only; the server decides, the tab is just hidden for the rest.
  const [canEditStructure, setCanEditStructure] = useState(false);
  const [tab, setTab] = useState<MenuTab>('visibility');
  useEffect(() => { void menuService.canEditStructure().then(setCanEditStructure); }, []);

  useEffect(() => setDraft(visibility), [visibility]);

  const modules = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return menuTree.map(mod => {
      const moduleMatches = `${mod.key} ${menuTitle(mod, language)}`.toLocaleLowerCase().includes(query);
      const subGroups = mod.subGroups?.map(group => {
        const groupMatches = `${group.groupCode} ${menuTitle(group, language)}`.toLocaleLowerCase().includes(query);
        return { ...group, items: group.items.filter(item =>
          !query || moduleMatches || groupMatches ||
          `${item.subKey} ${menuTitle(item, language)}`.toLocaleLowerCase().includes(query)) };
      }).filter(group => group.items.length > 0);
      const directMatches = mod.directSubKey?.toLocaleLowerCase().includes(query);
      return { ...mod, subGroups, showDirectFunction: !query || moduleMatches || Boolean(directMatches) };
    }).filter(mod => !query || mod.subGroups?.length || (mod.directSubKey && mod.showDirectFunction) ||
      `${mod.key} ${menuTitle(mod, language)}`.toLocaleLowerCase().includes(query));
  }, [language, search, menuTree]);

  const dirty = useMemo(() =>
    [...draft.hiddenModules].sort().join('|') !== [...visibility.hiddenModules].sort().join('|') ||
    [...draft.hiddenFunctions].sort().join('|') !== [...visibility.hiddenFunctions].sort().join('|'),
  [draft, visibility]);

  const toggleModule = (key: ModuleCategoryKey, visible: boolean) => {
    setDraft(prev => ({ ...prev, hiddenModules: visible
      ? prev.hiddenModules.filter(item => item !== key)
      : [...prev.hiddenModules, key] }));
  };
  const toggleFunction = (key: SubMenuKey, visible: boolean) => {
    setDraft(prev => ({ ...prev, hiddenFunctions: visible
      ? prev.hiddenFunctions.filter(item => item !== key)
      : [...prev.hiddenFunctions, key] }));
  };
  const save = async () => {
    setSaving(true);
    try {
      const saved = await systemSettingsService.saveMenuVisibility(draft);
      onSaved(saved);
      showToast.success(t('menuManager.saved'));
    } catch (error) {
      showToast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const tabBar = canEditStructure ? (
    <Tabs<MenuTab> value={tab} onChange={setTab} items={[
        { key: 'visibility', label: t('menuManager.tabVisibility') },
        { key: 'structure', label: t('menuManager.tabStructure') }
      ]} />
  ) : null;

  if (canEditStructure && tab === 'structure') return (
    <div className="space-y-4">
      {tabBar}
      <MenuStructureEditor onChanged={onStructureChanged} />
    </div>
  );

  return (
    <div className="space-y-4">
      {tabBar}
      <div className="sticky top-0 z-10 space-y-3 border-b border-slate-200 bg-slate-50 py-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Eye className="h-5 w-5" />{t('menuManager.title')}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('menuManager.description')}</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t('menuManager.permissionNote')}</p>
          </div>
          {canEdit && <Button type="button" size="sm" icon={<Save className="h-4 w-4" />} disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? t('menuManager.saving') : t('menuManager.save')}
          </Button>}
        </div>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)}
          placeholder={t('menuManager.search')} aria-label={t('menuManager.search')}
          className="w-full max-w-md rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </div>
      <div className="space-y-3">
        {modules.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">{t('menuManager.noResults')}</p>}
        {modules.map(mod => {
          const moduleVisible = !draft.hiddenModules.includes(mod.key);
          const locked = protectedModules.includes(mod.key);
          const functionCount = (mod.subGroups?.reduce((count, group) => count + group.items.length, 0) ?? 0) + (mod.directSubKey && mod.showDirectFunction ? 1 : 0);
          return <section key={mod.key} className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/30">
              {moduleVisible ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-slate-400" />}
              <Checkbox checked={moduleVisible} disabled={!canEdit || locked}
                label={<span className="font-bold">{menuTitle(mod, language)}</span>}
                onChange={visible => toggleModule(mod.key, visible)} />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{functionCount} {t('menuManager.functions')}</span>
              {locked && <span className="ml-auto text-[11px] text-slate-400">{t('menuManager.required')}</span>}
            </div>
            {!moduleVisible && <p className="border-b border-slate-100 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-slate-800 dark:bg-amber-950/20 dark:text-amber-300">{t('menuManager.moduleHidden')}</p>}
            {mod.subGroups?.map(group => <div key={group.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800">
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {menuTitle(group, language)}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.items.map(item => <div key={item.subKey} className="min-w-0 rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800"><Checkbox
                  checked={!draft.hiddenFunctions.includes(item.subKey)}
                  disabled={!canEdit || protectedFunctions.includes(item.subKey)}
                  label={menuTitle(item, language)}
                  subLabel={item.subKey}
                  onChange={visible => toggleFunction(item.subKey, visible)} /></div>)}
              </div>
            </div>)}
            {mod.directSubKey && mod.showDirectFunction && !locked && <div className="px-4 py-3">
              <Checkbox checked={!draft.hiddenFunctions.includes(mod.directSubKey)} disabled={!canEdit}
                label={t('menuManager.directFunction')} subLabel={mod.directSubKey}
                onChange={visible => toggleFunction(mod.directSubKey!, visible)} />
            </div>}
          </section>;
        })}
      </div>
    </div>
  );
};
