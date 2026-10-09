// Settings: one screen per function (config/functions.ts), opened from the sidebar menu like every other
// module, so each screen has its own address and goes through the screen guard in App.
import React from 'react';
import { CompanyUnit, SubMenuKey, UserProfile, Warehouse } from '../../types';
import { getActionPermission } from '../../utils/permissions';
import { UserPermissionManager } from './UserPermissionManager';
import { CompanyUnitCategoryView } from '../inventory/categories/company-units/CompanyUnitCategoryView';
import { DefaultConfigView } from './DefaultConfigView';
import { FiscalYearView } from './FiscalYearView';
import { CurrencyCategoryView } from './CurrencyCategoryView';
import { ExchangeRateCategoryView } from './ExchangeRateCategoryView';
import { DepartmentCategoryView } from './DepartmentCategoryView';
import { CompanySettingsView } from './CompanySettingsView';
import { LanguageCategoryView } from './LanguageCategoryView';
import { TaxRateCategoryView } from './TaxRateCategoryView';
import { AuditLogView } from './AuditLogView';
import { MenuManagementView } from './MenuManagementView';
import type { MenuVisibilityConfig } from '../../services/menuVisibility';
import type { SysModule } from '../../types/menu';

interface SettingsModuleProps {
  subKey: SubMenuKey;
  user: UserProfile;
  companyUnits?: CompanyUnit[];
  /** Demo warehouse catalog, for the default warehouse parameter. */
  warehouses?: Warehouse[];
  onAddCompanyUnit?: (unit: Omit<CompanyUnit, 'id'>) => Promise<boolean>;
  onUpdateCompanyUnit?: (id: string, unit: Partial<CompanyUnit>) => Promise<boolean>;
  onDeleteCompanyUnit?: (id: string) => Promise<boolean>;
  onCompanyUnitsChanged?: () => void | Promise<void>;
  onResetData: () => void;
  menuVisibility: MenuVisibilityConfig;
  menuTree: SysModule[];
  onMenuVisibilityChanged: (value: MenuVisibilityConfig) => void;
  onMenuStructureChanged: () => void;
}

/** A new settings screen needs sys_command menu fields and a case in renderScreen. */
export const SettingsModule: React.FC<SettingsModuleProps> = ({
  subKey,
  user,
  companyUnits = [],
  warehouses = [],
  onCompanyUnitsChanged,
  onResetData,
  menuVisibility,
  menuTree,
  onMenuVisibilityChanged,
  onMenuStructureChanged
}) => {
  // App only renders this module when the user may view subKey.
  const perms = getActionPermission(user, subKey);
  const rights = { canCreate: perms.create, canEdit: perms.edit, canDelete: perms.delete };

  const renderScreen = () => {
    switch (subKey) {
      case 'sys_default_config': return <DefaultConfigView {...rights} warehouses={warehouses} unitCode={user.ma_dvcs ?? ''} />;
      case 'sys_fiscal_year': return <FiscalYearView {...rights} unitCode={user.ma_dvcs ?? ''} />;
      case 'sys_currencies': return <CurrencyCategoryView currentUser={user} />;
      case 'sys_exchange_rates': return <ExchangeRateCategoryView currentUser={user} />;
      case 'sys_departments': return <DepartmentCategoryView currentUser={user} />;
      case 'sys_languages': return <LanguageCategoryView currentUser={user} />;
      case 'sys_tax_rates': return <TaxRateCategoryView currentUser={user} />;
      case 'sys_audit_log': return <AuditLogView {...rights} />;
      case 'sys_menu': return <MenuManagementView canEdit={perms.edit} visibility={menuVisibility} menuTree={menuTree} onSaved={onMenuVisibilityChanged} onStructureChanged={onMenuStructureChanged} />;
      case 'sys_users': return <UserPermissionManager currentUser={user} companyUnits={companyUnits} />;
      case 'inv_company_unit_cat':
        return (
          <CompanyUnitCategoryView currentUser={user} onChanged={onCompanyUnitsChanged} />
        );
      case 'settings_main': return <CompanySettingsView {...rights} user={user} onResetData={onResetData} />;
      default: return null;
    }
  };

  return <div className={subKey === 'sys_menu'
    ? 'space-y-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-2 custom-scrollbar'
    : 'space-y-4'}>{renderScreen()}</div>;
};
