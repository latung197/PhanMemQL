/**
 * Checks the sidebar logic against the menu the server seeds (ServerService/Core/SeedData/menu.json):
 * every node is known to the frontend, icons exist, and a user only gets the entries they may view.
 * The backend has the matching tests (MenuSeedFileTests, MenuFilterTests); this covers what only the frontend does.
 *
 *   npm run check-menu
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_NAMES, FUNCTION_REGISTRY } from '../src/config/functions';
import { ICON_NAMES } from '../src/components/common/DynamicIcon';
import { menuService, menuTitle, toTree, type MenuNode } from '../src/services/menuService';
import type { ActionPermissions, SubMenuKey, UserProfile } from '../src/types';

interface SeedItem { id: string; subKey: SubMenuKey; titleVi: string; titleEn: string; icon?: string; orderNo: number; isActive?: boolean }
interface SeedGroup { id: string; groupCode: string; titleVi: string; titleEn: string; icon?: string; orderNo: number; isActive?: boolean; items: SeedItem[] }
interface SeedModule { id: string; key: string; titleVi: string; titleEn: string; icon?: string; orderNo: number; directSubKey?: SubMenuKey; isActive?: boolean; subGroups?: SeedGroup[] }

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../../ServerService/Core/SeedData/menu.json');
const seed = JSON.parse(readFileSync(file, 'utf8')) as SeedModule[];

// The tree as GET /api/menu sends it: a function node's id is its function code.
const nodes: MenuNode[] = [];
for (const mod of seed) {
  nodes.push({ id: mod.id, parentId: null, nodeType: 'module', code: mod.key, titleVi: mod.titleVi, titleEn: mod.titleEn,
    titles: { vi: mod.titleVi, en: mod.titleEn }, icon: mod.icon ?? '', iconColor: null, badgeType: null,
    directFunctionCode: mod.directSubKey ?? null, orderNo: mod.orderNo, isActive: mod.isActive !== false });
  for (const group of mod.subGroups ?? []) {
    nodes.push({ id: group.id, parentId: mod.id, nodeType: 'group', code: group.groupCode, titleVi: group.titleVi, titleEn: group.titleEn,
      titles: { vi: group.titleVi, en: group.titleEn }, icon: group.icon ?? '', iconColor: null, badgeType: null,
      directFunctionCode: null, orderNo: group.orderNo, isActive: group.isActive !== false });
    for (const item of group.items)
      nodes.push({ id: item.subKey, parentId: group.id, nodeType: 'function', code: item.subKey, titleVi: item.titleVi, titleEn: item.titleEn,
        titles: { vi: item.titleVi, en: item.titleEn }, icon: item.icon ?? '', iconColor: null, badgeType: null,
        directFunctionCode: null, orderNo: item.orderNo, isActive: item.isActive !== false });
  }
}

const failures: string[] = [];
const check = (name: string, ok: boolean, detail = '') => { if (!ok) failures.push(`${name}${detail ? ': ' + detail : ''}`); };

// 1. Nothing in the seed may be dropped silently by toTree (it ignores codes the frontend does not know).
const tree = toTree(nodes);
const treeFunctions = new Set(tree.flatMap(m => (m.subGroups ?? []).flatMap(g => g.items.map(i => i.subKey))));
const seedFunctions = nodes.filter(n => n.nodeType === 'function').map(n => n.code);
check('menu functions unknown to FUNCTION_REGISTRY', seedFunctions.every(code => treeFunctions.has(code as SubMenuKey)),
  seedFunctions.filter(code => !treeFunctions.has(code as SubMenuKey)).join(', '));
check('module keys unknown to CATEGORY_NAMES', seed.every(m => Object.hasOwn(CATEGORY_NAMES, m.key)),
  seed.filter(m => !Object.hasOwn(CATEGORY_NAMES, m.key)).map(m => m.key).join(', '));
check('every group sits in a module', tree.every(m => (m.subGroups ?? []).every(g => g.id)));

// 2. Every function of the registry is reachable from the menu (a group item or a module's direct function).
const direct = new Set(seed.map(m => m.directSubKey).filter(Boolean));
const unreachable = (Object.keys(FUNCTION_REGISTRY) as SubMenuKey[]).filter(code => !treeFunctions.has(code) && !direct.has(code));
check('FUNCTION_REGISTRY functions missing from menu.json', unreachable.length === 0, unreachable.join(', '));

// 3. Icons exist, otherwise the sidebar shows the default icon.
const icons = new Set(ICON_NAMES);
const badIcons = [...new Set(nodes.map(n => n.icon).filter(icon => icon && !icons.has(icon)))];
check('icons not registered in DynamicIcon', badIcons.length === 0, badIcons.join(', '));

// 4. Titles: every language falls back to Vietnamese.
check('menuTitle falls back to Vietnamese', menuTitle({ titleVi: 'A', titleEn: '' }, 'en') === 'A');
check('menuTitle uses English when present', menuTitle({ titleVi: 'A', titleEn: 'B' }, 'en') === 'B');

// 5. Who sees what.
const none: ActionPermissions = { view: false, create: false, edit: false, delete: false, approve: false, print: false, export: false };
const viewOnly: ActionPermissions = { ...none, view: true };
const user = (view: SubMenuKey[], isSystemAdmin = false): UserProfile => ({
  isSystemAdmin, permissions: Object.fromEntries(view.map(code => [code, viewOnly]))
} as unknown as UserProfile);
const visible = (u: UserProfile, config?: Parameters<typeof menuService.getUserMenuTree>[4], mutate?: (t: typeof tree) => void) => {
  const copy = structuredClone(tree);
  mutate?.(copy);
  return menuService.getUserMenuTree(copy, 'vi', u, undefined, config).flatMap(m => m.subGroups.flatMap(g => g.items.map(i => i.subKey)));
};
const allActive = seedFunctions;

check('admin sees every active function', allActive.every(code => visible(user([], true)).includes(code as SubMenuKey)));
check('user without rights sees no function', visible(user([])).length === 0);
check('user sees exactly the functions they may view',
  JSON.stringify(visible(user(['inv_uom_cat', 'inv_receipt'])).sort()) === JSON.stringify(['inv_receipt', 'inv_uom_cat']));
check('hidden function is not shown', !visible(user(['inv_uom_cat']), { hiddenModules: [], hiddenFunctions: ['inv_uom_cat'] }).includes('inv_uom_cat'));
check('hidden module hides its functions', visible(user(['inv_uom_cat']), { hiddenModules: ['inventory'], hiddenFunctions: [] }).length === 0);
check('inactive function is not shown', !visible(user(['inv_uom_cat']), undefined, t =>
  t.forEach(m => m.subGroups?.forEach(g => g.items.forEach(i => { if (i.subKey === 'inv_uom_cat') i.isActive = false })))).includes('inv_uom_cat'));
check('inactive group hides its functions', visible(user(['inv_uom_cat']), undefined, t =>
  t.forEach(m => m.subGroups?.forEach(g => { if (g.items.some(i => i.subKey === 'inv_uom_cat')) g.isActive = false }))).length === 0);
check('inactive module hides its functions', visible(user(['inv_uom_cat']), undefined, t =>
  t.forEach(m => { if (m.key === 'inventory') m.isActive = false })).length === 0);
check('groups left empty are dropped', menuService.getUserMenuTree(tree, 'vi', user(['inv_uom_cat']))
  .every(m => m.subGroups.every(g => g.items.length > 0)));

console.log(`menu: ${nodes.length} nodes, ${seedFunctions.length} functions, ${ICON_NAMES.length} icons`);
if (failures.length > 0) {
  console.error(`check-menu FAILED (${failures.length}):\n - ` + failures.join('\n - '));
  process.exit(1);
}
console.log('check-menu OK');
