import { SysResource, SysEntityLocalization } from '../types/i18nDb';

/**
 * INITIAL DATABASE SEED DATA FOR MULTI-LANGUAGE SYSTEM RESOURCES & ENTITY LOCALIZATIONS
 */

export const INITIAL_SYS_RESOURCES: SysResource[] = [
  // Menu System Titles
  { id: 'RES_001', categoryCode: 'MENU', resourceKey: 'sys.menu.inventory', cultureCode: 'vi', resourceValue: 'Phân Hệ Quản Lý Kho', updatedAt: '2026-08-01' },
  { id: 'RES_002', categoryCode: 'MENU', resourceKey: 'sys.menu.inventory', cultureCode: 'en', resourceValue: 'Inventory Management Module', updatedAt: '2026-08-01' },
  { id: 'RES_003', categoryCode: 'MENU', resourceKey: 'sys.menu.company_units', cultureCode: 'vi', resourceValue: 'Danh mục Đơn vị cơ sở', updatedAt: '2026-08-01' },
  { id: 'RES_004', categoryCode: 'MENU', resourceKey: 'sys.menu.company_units', cultureCode: 'en', resourceValue: 'Company Units Catalog', updatedAt: '2026-08-01' },

  // Catalog Titles
  { id: 'RES_005', categoryCode: 'CATALOG', resourceKey: 'sys.catalog.material_type', cultureCode: 'vi', resourceValue: 'Loại Vật Tư Sản Xuất', updatedAt: '2026-08-01' },
  { id: 'RES_006', categoryCode: 'CATALOG', resourceKey: 'sys.catalog.material_type', cultureCode: 'en', resourceValue: 'Manufacturing Material Type', updatedAt: '2026-08-01' },

  // System & Dynamic Messages
  { id: 'RES_007', categoryCode: 'SYSTEM', resourceKey: 'sys.msg.welcome_company', cultureCode: 'vi', resourceValue: 'Chào mừng đến với Hệ thống Quản trị Doanh nghiệp ERP', updatedAt: '2026-08-01' },
  { id: 'RES_008', categoryCode: 'SYSTEM', resourceKey: 'sys.msg.welcome_company', cultureCode: 'en', resourceValue: 'Welcome to Enterprise Resource Planning (ERP) System', updatedAt: '2026-08-01' },
  { id: 'RES_009', categoryCode: 'REPORT', resourceKey: 'sys.report.stock_summary', cultureCode: 'vi', resourceValue: 'Báo cáo Tổng hợp Nhập Xuất Tồn Kho Hàng', updatedAt: '2026-08-01' },
  { id: 'RES_010', categoryCode: 'REPORT', resourceKey: 'sys.report.stock_summary', cultureCode: 'en', resourceValue: 'Inventory Movement & Stock Balance Summary Report', updatedAt: '2026-08-01' }
];

export const INITIAL_ENTITY_LOCALIZATIONS: SysEntityLocalization[] = [
  // Material 001 Translation
  { id: 'LOC_001', entityName: 'SysMaterial', entityId: 'MAT001', fieldName: 'name', cultureCode: 'en', localizedValue: 'Stainless Steel Sheet 304 (2.0mm)' },
  { id: 'LOC_002', entityName: 'SysMaterial', entityId: 'MAT001', fieldName: 'description', cultureCode: 'en', localizedValue: 'High grade corrosion resistant stainless steel plate for industrial manufacturing' },
  
  // Warehouse 001 Translation
  { id: 'LOC_003', entityName: 'SysWarehouse', entityId: 'WH_MAIN', fieldName: 'name', cultureCode: 'en', localizedValue: 'Central Distribution Warehouse Hanoi' },
  
  // Company Unit Translation
  { id: 'LOC_004', entityName: 'SysCompanyUnit', entityId: 'UNIT_HQ', fieldName: 'name', cultureCode: 'en', localizedValue: 'Ha Noi Headquarters & Plant' }
];
