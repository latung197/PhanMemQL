import { ModuleCategoryKey, SubMenuKey } from './index';

/** Sidebar menu: modules (phân hệ) → groups (Danh mục, Chứng từ, Báo cáo...) → items (one function each). */

export interface SysMenuItem {
  id: string;
  /** The function opened by the item; its route and permission come from config/functions.ts. */
  subKey: SubMenuKey;
  titleVi: string;
  titleEn: string;
  titles?: Record<string, string>;
  icon: string; // Lucide icon identifier e.g. "Package", "Building2"
  orderNo: number;
  badgeType?: 'lowStock' | 'pendingOrder';
  isActive: boolean;
}

export interface SysMenuGroup {
  id: string;
  groupCode: string;
  titleVi: string;
  titleEn: string;
  titles?: Record<string, string>;
  icon: string; // e.g. "FolderTree", "FileText"
  iconColor?: string; // e.g. "text-indigo-400"
  orderNo: number;
  items: SysMenuItem[];
  isActive: boolean;
}

export interface SysModule {
  id: string;
  key: ModuleCategoryKey;
  titleVi: string;
  titleEn: string;
  titles?: Record<string, string>;
  icon: string; // e.g. "Layers", "BarChart"
  orderNo: number;
  directSubKey?: SubMenuKey;
  subGroups?: SysMenuGroup[];
  isActive: boolean;
}

/**
 * Format expected by client sidebar when rendered from Database payload
 */
export interface TransformedMenuItem {
  subKey: SubMenuKey;
  label: string;
  iconName: string;
}

export interface TransformedMenuGroup {
  groupTitle: string;
  iconName: string;
  iconColor?: string;
  items: TransformedMenuItem[];
}

export interface TransformedModuleItem {
  key: ModuleCategoryKey;
  title: string;
  iconName: string;
  badgeCount?: number;
  directSubKey?: SubMenuKey;
  subGroups?: TransformedMenuGroup[];
}
