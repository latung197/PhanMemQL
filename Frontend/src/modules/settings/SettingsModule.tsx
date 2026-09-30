// Settings: one tab per function (config/functions.ts). A tab is shown only when the user may view its
// function; clicking it navigates, so every tab has its own address and goes through the screen guard.
import React from 'react';
import { Building2, Calendar, Coins, Landmark, Network, Shield, Sliders, TrendingUp } from 'lucide-react';
import { Tabs } from '../../components/common/Tabs';
import { CompanyUnit, SubMenuKey, UserProfile, Warehouse } from '../../types';
import { FUNCTION_REGISTRY } from '../../config/functions';
import { canView, getActionPermission } from '../../utils/permissions';
import { UserPermissionManager } from './UserPermissionManager';
import { CompanyUnitCategoryView } from '../inventory/company-units/CompanyUnitCategoryView';
import { DefaultConfigView } from './DefaultConfigView';
import { FiscalYearView } from './FiscalYearView';
import { CurrencyCategoryView } from './CurrencyCategoryView';
import { ExchangeRateView } from './ExchangeRateView';
import { DepartmentCategoryView } from './DepartmentCategoryView';
import { CompanySettingsView } from './CompanySettingsView';

interface SettingsModuleProps {
  subKey: SubMenuKey;
  user: UserProfile;
  companyUnits?: CompanyUnit[];
  /** Demo warehouse catalog, for the default warehouse parameter. */
  warehouses?: Warehouse[];
  onSelectSubKey: (subKey: SubMenuKey) => void;
  onAddCompanyUnit?: (unit: Omit<CompanyUnit, 'id'>) => Promise<boolean>;
  onUpdateCompanyUnit?: (id: string, unit: Partial<CompanyUnit>) => Promise<boolean>;
  onDeleteCompanyUnit?: (id: string) => Promise<boolean>;
  onResetData: () => void;
}

/** Settings screens in tab order. A new settings screen: add its function here and a case below. */
const TABS: { fn: SubMenuKey; icon: React.ReactElement }[] = [
  { fn: 'sys_default_config', icon: <Sliders /> },
  { fn: 'sys_fiscal_year', icon: <Calendar /> },
  { fn: 'sys_currencies', icon: <Coins /> },
  { fn: 'sys_exchange_rates', icon: <TrendingUp /> },
  { fn: 'inv_company_unit_cat', icon: <Building2 /> },
  { fn: 'sys_departments', icon: <Network /> },
  { fn: 'sys_users', icon: <Shield /> },
  { fn: 'settings_main', icon: <Landmark /> }
];

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  subKey,
  user,
  companyUnits = [],
  warehouses = [],
  onSelectSubKey,
  onAddCompanyUnit = async () => false,
  onUpdateCompanyUnit,
  onDeleteCompanyUnit,
  onResetData
}) => {
  const tabs = TABS.filter(tab => canView(user, tab.fn));
  // App only renders this module when the user may view subKey, so it is one of the tabs.
  const active = tabs.some(t => t.fn === subKey) ? subKey : tabs[0]?.fn;
  const perms = getActionPermission(user, active);
  const rights = { canEdit: perms.createEdit, canDelete: perms.delete };

  const renderScreen = () => {
    switch (active) {
      case 'sys_default_config': return <DefaultConfigView {...rights} warehouses={warehouses} unitCode={user.ma_dvcs ?? ''} />;
      case 'sys_fiscal_year': return <FiscalYearView {...rights} unitCode={user.ma_dvcs ?? ''} />;
      case 'sys_currencies': return <CurrencyCategoryView {...rights} />;
      case 'sys_exchange_rates': return <ExchangeRateView {...rights} />;
      case 'sys_departments': return <DepartmentCategoryView {...rights} />;
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

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[5px] p-2 shadow-2xs">
        <Tabs
          value={active}
          onChange={onSelectSubKey}
          items={tabs.map(tab => ({ key: tab.fn, label: FUNCTION_REGISTRY[tab.fn].label, icon: tab.icon }))}
        />
      </div>
      {renderScreen()}
    </div>
  );
};
