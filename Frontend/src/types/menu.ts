import { ModuleCategoryKey, SubMenuKey } from './index';

/**
 * Entity specification for System Menu items mapped directly to database tables:
 * - SysModules (Phân hệ chính)
 * - SysMenuGroups (Nhóm chức năng: Danh mục, Chứng từ, Báo cáo...)
 * - SysMenuItems (Màn hình chức năng chi tiết)
 */

export interface SysMenuItem {
  id: string;
  subKey: SubMenuKey;
  titleVi: string;
  titleEn: string;
  icon: string; // Lucide icon identifier e.g. "Package", "Building2"
  routePath?: string;
  orderNo: number;
  badgeType?: 'lowStock' | 'pendingOrder';
  requiredPermission?: SubMenuKey;
  isActive: boolean;
}

export interface SysMenuGroup {
  id: string;
  groupCode: string;
  titleVi: string;
  titleEn: string;
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
  icon: string; // e.g. "Layers", "BarChart"
  orderNo: number;
  directSubKey?: SubMenuKey;
  subGroups?: SysMenuGroup[];
  isActive: boolean;
  requiredPermission?: SubMenuKey;
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
