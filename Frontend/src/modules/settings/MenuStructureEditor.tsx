import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Checkbox } from '../../components/common/Checkbox';
import { DynamicIcon, ICON_NAMES } from '../../components/common/DynamicIcon';
import { SelectInput, TextInput } from '../../components/common/FormField';
import { Modal } from '../../components/common/Modal';
import { ErrorState, LoadingState } from '../../components/common/StateViews';
import { useLanguage } from '../../context/LanguageContext';
import { getErrorMessage } from '../../services/apiClient';
import { menuService, menuTitle, type MenuNode } from '../../services/menuService';
import { showToast } from '../../utils/toast';

type NodeType = MenuNode['nodeType'];

interface Draft {
  /** Null while a new group is being created. */
  id: string | null;
  nodeType: NodeType;
  titles: Record<string, string>;
  icon: string;
  iconColor: string;
  orderNo: number;
  isActive: boolean;
  parentId: string | null;
  code: string;
}

const bySort = (a: MenuNode, b: MenuNode) => a.orderNo - b.orderNo || a.id.localeCompare(b.id);

/**
 * Structure editor of the super administrator: names per language, icon, order, group of a function, and new
 * groups. Functions are never added or removed here; they come from code (FunctionCatalog, screens, rights).
 */
export const MenuStructureEditor: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const { language, languages, t } = useLanguage();
  const [nodes, setNodes] = useState<MenuNode[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setNodes(await menuService.loadAllNodes());
      setLoadError('');
    } catch (error) {
      setLoadError(getErrorMessage(error));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const children = useMemo(() => {
    const map = new Map<string | null, MenuNode[]>();
    for (const node of [...(nodes ?? [])].sort(bySort)) {
      const list = map.get(node.parentId) ?? [];
      list.push(node);
      map.set(node.parentId, list);
    }
    return map;
  }, [nodes]);

  const modules = (children.get(null) ?? []).filter(node => node.nodeType === 'module');
  const label = (node: MenuNode) => menuTitle(node, language);
  const nodeById = (id: string | null) => nodes?.find(node => node.id === id);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await load();
      onChanged();
      showToast.success(t('menuManager.structureSaved'));
    } catch (error) {
      showToast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const move = (node: MenuNode, step: -1 | 1) => {
    const siblings = (children.get(node.parentId) ?? []).filter(item => item.nodeType === node.nodeType);
    const index = siblings.findIndex(item => item.id === node.id);
    const target = index + step;
    if (target < 0 || target >= siblings.length) return;
    const ids = siblings.map(item => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() => menuService.reorder(node.parentId, ids));
  };

  const openEdit = (node: MenuNode) => setDraft({
    id: node.id, nodeType: node.nodeType, titles: { ...node.titles, vi: node.titles.vi ?? node.titleVi },
    icon: node.icon, iconColor: node.iconColor ?? '', orderNo: node.orderNo, isActive: node.isActive,
    parentId: node.parentId, code: node.code
  });
  const openCreateGroup = (moduleNode: MenuNode) => setDraft({
    id: null, nodeType: 'group', titles: { vi: '' }, icon: 'FolderTree', iconColor: '',
    orderNo: ((children.get(moduleNode.id) ?? []).at(-1)?.orderNo ?? 0) + 10, isActive: true, parentId: moduleNode.id, code: ''
  });

  const parentOptions = (nodeType: NodeType) => nodeType === 'function'
    ? modules.flatMap(mod => (children.get(mod.id) ?? []).filter(g => g.nodeType === 'group')
        .map(group => ({ value: group.id, label: `${label(mod)} › ${label(group)}` })))
    : modules.map(mod => ({ value: mod.id, label: label(mod) }));

  const save = () => {
    if (!draft) return;
    const titles = Object.fromEntries(Object.entries(draft.titles).map(([code, text]) => [code, text.trim()]));
    const iconColor = draft.iconColor.trim() || null;
    void run(async () => {
      if (draft.id === null) {
        await menuService.createGroup({ moduleId: draft.parentId!, code: draft.code.trim(), titles, icon: draft.icon, iconColor, orderNo: draft.orderNo });
      } else {
        await menuService.saveNode(draft.id, { titles, icon: draft.icon, iconColor, orderNo: draft.orderNo, isActive: draft.isActive, parentId: draft.parentId });
      }
      setDraft(null);
    });
  };

  if (loadError) return <ErrorState message={`${t('menuManager.loadFailed')}: ${loadError}`} onRetry={() => void load()} />;
  if (!nodes) return <LoadingState />;

  const row = (node: MenuNode, depth: number, canAddGroup = false) => {
    const siblings = (children.get(node.parentId) ?? []).filter(item => item.nodeType === node.nodeType);
    const index = siblings.findIndex(item => item.id === node.id);
    return (
      <div key={node.id} style={{ paddingLeft: depth * 20 }}
        className={`flex flex-wrap items-center gap-2 border-b border-slate-100 py-1.5 pr-2 last:border-b-0 dark:border-slate-800 ${node.isActive ? '' : 'opacity-60'}`}>
        <DynamicIcon name={node.icon} className="h-4 w-4 shrink-0 text-slate-500" />
        <span className={`min-w-0 truncate text-xs ${node.nodeType === 'function' ? '' : 'font-bold'}`}>{label(node)}</span>
        <span className="text-[11px] text-slate-400">{node.code}</span>
        {!node.isActive && <span className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800">{t('menuManager.inactive')}</span>}
        <span className="ml-auto flex items-center gap-1">
          {canAddGroup && <Button type="button" size="sm" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} disabled={busy} onClick={() => openCreateGroup(node)}>{t('menuManager.addGroup')}</Button>}
          <Button type="button" size="sm" variant="ghost" aria-label={t('menuManager.moveUp')} title={t('menuManager.moveUp')} disabled={busy || index <= 0} onClick={() => move(node, -1)} icon={<ArrowUp className="h-3.5 w-3.5" />} />
          <Button type="button" size="sm" variant="ghost" aria-label={t('menuManager.moveDown')} title={t('menuManager.moveDown')} disabled={busy || index >= siblings.length - 1} onClick={() => move(node, 1)} icon={<ArrowDown className="h-3.5 w-3.5" />} />
          <Button type="button" size="sm" variant="ghost" aria-label={t('menuManager.edit')} title={t('menuManager.edit')} disabled={busy} onClick={() => openEdit(node)} icon={<Pencil className="h-3.5 w-3.5" />} />
        </span>
      </div>
    );
  };

  const languageCodes = Array.from(new Set([...languages.map(item => item.code), ...Object.keys(draft?.titles ?? {})]));
  const editing = draft?.id ? nodeById(draft.id) : undefined;
  const canPickParent = draft && draft.nodeType !== 'module' && draft.id !== null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('menuManager.structureNote')}</p>
      {modules.map(mod => (
        <section key={mod.id} className="rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
          {row(mod, 0, true)}
          {(children.get(mod.id) ?? []).filter(group => group.nodeType === 'group').map(group => (
            <React.Fragment key={group.id}>
              {row(group, 1)}
              {(children.get(group.id) ?? []).filter(item => item.nodeType === 'function').map(item => row(item, 2))}
            </React.Fragment>
          ))}
        </section>
      ))}

      <Modal isOpen={draft !== null} onClose={() => setDraft(null)} maxWidth="lg"
        title={draft?.id === null ? t('menuManager.createGroupTitle') : t('menuManager.editTitle')}>
        {draft && <form className="space-y-3" onSubmit={event => { event.preventDefault(); save(); }}>
          {draft.id === null && <TextInput label={t('menuManager.groupCode')} hint={t('menuManager.groupCodeHint')} required
            value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value })} />}
          {languageCodes.map(code => <TextInput key={code} label={t('menuManager.nameIn', { lang: code })}
            required={code === 'vi'} maxLength={100} value={draft.titles[code] ?? ''}
            onChange={event => setDraft({ ...draft, titles: { ...draft.titles, [code]: event.target.value } })} />)}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-end gap-2">
              <SelectInput wrapperClassName="flex-1" label={t('menuManager.icon')} value={draft.icon}
                options={ICON_NAMES.map(name => ({ value: name, label: name }))}
                onChange={event => setDraft({ ...draft, icon: event.target.value })} />
              <DynamicIcon name={draft.icon} className="mb-2 h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
            {draft.nodeType === 'group' && <TextInput label={t('menuManager.iconColor')} placeholder="text-emerald-400" maxLength={64}
              value={draft.iconColor} onChange={event => setDraft({ ...draft, iconColor: event.target.value })} />}
            <TextInput type="number" label={t('menuManager.order')} min={0} max={100000} value={draft.orderNo}
              onChange={event => setDraft({ ...draft, orderNo: Number(event.target.value) })} />
            {canPickParent && <SelectInput label={t('menuManager.parent')} value={draft.parentId ?? ''}
              options={parentOptions(draft.nodeType)} onChange={event => setDraft({ ...draft, parentId: event.target.value })} />}
          </div>
          {draft.id !== null && <Checkbox checked={draft.isActive} label={t('menuManager.active')}
            subLabel={editing?.code} onChange={isActive => setDraft({ ...draft, isActive })} />}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>{t('menuManager.cancel')}</Button>
            <Button type="submit" disabled={busy}>{t('menuManager.saveNode')}</Button>
          </div>
        </form>}
      </Modal>
    </div>
  );
};
