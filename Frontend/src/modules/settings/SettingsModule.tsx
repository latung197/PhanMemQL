// Settings: one screen per function (config/functions.ts), opened from the sidebar menu like every other
// module, so each screen has its own address and goes through the screen guard in App.
import React from 'react';
import { CompanyUnit, SubMenuKey, UserProfile, Warehouse } from '../../types';
import { getActionPermission } from '../../utils/permissions';
import { UserPermissionManager } from './UserPermissionManager';
import { CompanyUnitCategoryView } from '../inventory/company-units/CompanyUnitCategoryView';
import { DefaultConfigView } from './DefaultConfigView';
import { FiscalYearView } from './FiscalYearView';
import { CurrencyCategoryView } from './CurrencyCategoryView';
import { ExchangeRateView } from './ExchangeRateView';
import { DepartmentCategoryView } from './DepartmentCategoryView';
import { CompanySettingsView } from './CompanySettingsView';
import { LanguageCategoryView } from './LanguageCategoryView';
import { AuditLogView } from './AuditLogView';

interface SettingsModuleProps {
  subKey: SubMenuKey;
  user: UserProfile;
  companyUnits?: CompanyUnit[];
  /** Demo warehouse catalog, for the default warehouse parameter. */
  warehouses?: Warehouse[];
  onAddCompanyUnit?: (unit: Omit<CompanyUnit, 'id'>) => Promise<boolean>;
  onUpdateCompanyUnit?: (id: string, unit: Partial<CompanyUnit>) => Promise<boolean>;
  onDeleteCompanyUnit?: (id: string) => Promise<boolean>;
  onResetData: () => void;
}

/** A new settings screen: a sidebar item in mock/initialMenuData.ts and a case in renderScreen. */
export const SettingsModule: React.FC<SettingsModuleProps> = ({
  subKey,
  user,
  companyUnits = [],
  warehouses = [],
  onAddCompanyUnit = async () => false,
  onUpdateCompanyUnit,
  onDeleteCompanyUnit,
  onResetData
}) => {
  // App only renders this module when the user may view subKey.
  const perms = getActionPermission(user, subKey);
  const rights = { canEdit: perms.createEdit, canDelete: perms.delete };

  const renderScreen = () => {
    switch (subKey) {
      case 'sys_default_config': return <DefaultConfigView {...rights} warehouses={warehouses} unitCode={user.ma_dvcs ?? ''} />;
      case 'sys_fiscal_year': return <FiscalYearView {...rights} unitCode={user.ma_dvcs ?? ''} />;
      case 'sys_currencies': return <CurrencyCategoryView {...rights} />;
      case 'sys_exchange_rates': return <ExchangeRateView {...rights} />;
      case 'sys_departments': return <DepartmentCategoryView {...rights} />;
      case 'sys_languages': return <LanguageCategoryView {...rights} />;
      case 'sys_audit_log': return <AuditLogView />;
      case 'sys_users': return <UserPermissionManager currentUser={user} companyUnits={companyUnits} />;
      case 'inv_company_unit_cat':
        return (
          <CompanyUnitCategoryView companyUnits={companyUnits} onAddCompanyUnit={onAddCompanyUnit}
            onUpdateCompanyUnit={onUpdateCompanyUnit} onDeleteCompanyUnit={onDeleteCompanyUnit} currentUser={user} />
        );
      case 'settings_main': return <CompanySettingsView {...rights} user={user} onResetData={onResetData} />;
      default: return null;
    }
  };

  return <div className="space-y-4">{renderScreen()}</div>;
};
