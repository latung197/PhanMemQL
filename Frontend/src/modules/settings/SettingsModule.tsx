import React, { useState, useEffect } from 'react';
import { 
  User, 
  Settings, 
  Shield, 
  Database, 
  Check, 
  Save, 
  RotateCcw, 
  Moon, 
  Sun, 
  Server, 
  Code, 
  Wifi, 
  Languages, 
  Calculator, 
  Building2, 
  Sliders, 
  Calendar, 
  Coins, 
  TrendingUp,
  Download,
  Upload,
  AlertTriangle,
  Lock,
  Layers
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Tabs } from '../../components/common/Tabs';
import { TextInput, TextArea } from '../../components/common/FormField';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { UserProfile, CompanyUnit, SubMenuKey } from '../../types';
import { UserPermissionManager } from './UserPermissionManager';
import { I18nDbManager } from './I18nDbManager';
import { NumberFormatSettings } from './NumberFormatSettings';
import { SystemSchemaViewer } from '../system/SystemSchemaViewer';
import { CompanyUnitCategoryView } from '../inventory/company-units/CompanyUnitCategoryView';
import { DefaultConfigView } from './DefaultConfigView';
import { FiscalYearView } from './FiscalYearView';
import { CurrencyCategoryView } from './CurrencyCategoryView';
import { ExchangeRateView } from './ExchangeRateView';
import { showToast, saveWithFeedback } from '../../utils/toast';
import { systemSettingsService, CompanyProfileConfig } from '../../services/systemSettingsService';
import { getActionPermission } from '../../utils/permissions';

type SettingTabKey = 
  | 'default_config'
  | 'fiscal_year'
  | 'currencies'
  | 'exchange_rates'
  | 'number_format'
  | 'company_units'
  | 'permissions'
  | 'company_profile'
  | 'sys_schema'
  | 'i18n_db'
  | 'data_management';

interface SettingsModuleProps {
  subKey?: SubMenuKey;
  user: UserProfile;
  companyUnits?: CompanyUnit[];
  onAddCompanyUnit?: (unit: Omit<CompanyUnit, 'id'>) => Promise<boolean>;
  onUpdateCompanyUnit?: (id: string, unit: Partial<CompanyUnit>) => Promise<boolean>;
  onDeleteCompanyUnit?: (id: string) => Promise<boolean>;
  onResetData: () => void;
}

const mapSubKeyToTab = (key?: SubMenuKey): SettingTabKey => {
  switch (key) {
    case 'sys_default_config': return 'default_config';
    case 'sys_fiscal_year': return 'fiscal_year';
    case 'sys_currencies': return 'currencies';
    case 'sys_exchange_rates': return 'exchange_rates';
    case 'inv_company_unit_cat': return 'company_units';
    case 'sys_users': return 'permissions';
    default: return 'default_config';
  }
};

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  subKey,
  user,
  companyUnits = [],
  onAddCompanyUnit = async () => false,
  onUpdateCompanyUnit,
  onDeleteCompanyUnit,
  onResetData
}) => {
  const canEditCompanyProfile = getActionPermission(user, 'settings_main').createEdit;
  const [activeTab, setActiveTab] = useState<SettingTabKey>(() => mapSubKeyToTab(subKey));

  // Sync activeTab whenever subKey prop changes
  useEffect(() => {
    if (subKey && subKey !== 'settings_main') {
      setActiveTab(mapSubKeyToTab(subKey));
    }
  }, [subKey]);

  // Company Profile State
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileConfig>(() => 
    systemSettingsService.getCompanyProfile()
  );

  const confirm = useConfirm();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  const handleSaveCompanyProfile = (e: React.FormEvent) => {
    e.preventDefault();
    void saveWithFeedback(systemSettingsService.saveCompanyProfile(companyProfile),
      () => showToast.success('Đã lưu thông tin pháp lý doanh nghiệp thành công!'));
  };

  const handleExportConfig = () => {
    const jsonStr = systemSettingsService.exportFullConfig();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `s-erp-settings-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast.success('Đã xuất file cấu hình JSON thành công!');
  };

  const handleImportConfig = () => {
    if (!importJsonText.trim()) {
      showToast.error('Vui lòng dán chuỗi JSON cấu hình!');
      return;
    }
    void saveWithFeedback(systemSettingsService.importFullConfig(importJsonText), () => {
      setCompanyProfile(systemSettingsService.getCompanyProfile());
      setIsImportModalOpen(false);
      setImportJsonText('');
      showToast.success('Đã phục hồi cấu hình hệ thống từ file JSON thành công!');
    });
  };

  const handleResetAll = async () => {
    const ok = await confirm({
      title: 'Xác Nhận Khôi Phục Dữ Liệu Ban Đầu',
      message: 'Toàn bộ cấu hình hệ thống sẽ về giá trị mặc định và dữ liệu mẫu trong trình duyệt được nạp lại. Thao tác không thể hoàn tác. Bạn có chắc chắn muốn tiếp tục?',
      confirmLabel: 'Xác Nhận Khôi Phục',
      tone: 'danger'
    });
    if (!ok) return;
    void saveWithFeedback(systemSettingsService.resetAllSettings(), () => {
      onResetData();
      setCompanyProfile(systemSettingsService.getCompanyProfile());
      showToast.success('Đã khôi phục toàn bộ cơ sở dữ liệu và cấu hình ERP về mặc định ban đầu!');
    });
  };

  return (
    <div className="space-y-4">
      {/* Settings Navigation Tab Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[5px] p-2 shadow-2xs">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'default_config', label: '1. Tham Số Mặc Định', icon: <Sliders />, tone: 'emerald' },
            { key: 'fiscal_year', label: '2. Năm Tài Chính & Khóa Sổ', icon: <Calendar /> },
            { key: 'currencies', label: '3. Ngoại Tệ & Tiền Tệ', icon: <Coins />, tone: 'amber' },
            { key: 'exchange_rates', label: '4. Tỷ Giá Ngoại Tệ', icon: <TrendingUp />, tone: 'emerald' },
            { key: 'number_format', label: '5. Định Dạng Số & Tiền', icon: <Calculator /> },
            { key: 'company_units', label: `6. Đơn Vị Cơ Sở (${companyUnits.length})`, icon: <Building2 />, tone: 'cyan' },
            { key: 'permissions', label: '7. Phân Quyền & User', icon: <Shield /> },
            { key: 'company_profile', label: '8. Hồ Sơ Doanh Nghiệp', icon: <Settings /> },
            { key: 'sys_schema', label: '9. Từ Điển sys_*', icon: <Database />, tone: 'purple' },
            { key: 'i18n_db', label: '10. Đa Ngôn Ngữ C# API', icon: <Languages />, tone: 'blue' },
            { key: 'data_management', label: '11. Sao Lưu & Phục Hồi', icon: <Server />, tone: 'rose' }
          ]}
        />
      </div>
      {/* Tab 1: Default Configurations */}
      {activeTab === 'default_config' && (
        <DefaultConfigView />
      )}

      {/* Tab 2: Fiscal Year & Lock Date */}
      {activeTab === 'fiscal_year' && (
        <FiscalYearView currentUsername={user.username} />
      )}

      {/* Tab 3: Currencies */}
      {activeTab === 'currencies' && (
        <CurrencyCategoryView />
      )}

      {/* Tab 4: Exchange Rates */}
      {activeTab === 'exchange_rates' && (
        <ExchangeRateView />
      )}

      {/* Tab 5: Number Formatting */}
      {activeTab === 'number_format' && (
        <NumberFormatSettings />
      )}

      {/* Tab 6: Company Units */}
      {activeTab === 'company_units' && (
        <CompanyUnitCategoryView
          companyUnits={companyUnits}
          onAddCompanyUnit={onAddCompanyUnit}
          onUpdateCompanyUnit={onUpdateCompanyUnit}
          onDeleteCompanyUnit={onDeleteCompanyUnit}
          currentUser={user}
        />
      )}

      {/* Tab 7: Permissions & Users */}
      {activeTab === 'permissions' && (
        <UserPermissionManager
          currentUser={user}
          companyUnits={companyUnits}
        />
      )}

      {/* Tab 8: Company legal profile. Personal account settings are in the header user menu. */}
      {activeTab === 'company_profile' && (
        <div className="space-y-6">
          {/* Company Legal Profile Form */}
          <Card className="rounded-[5px] border border-slate-200 dark:border-slate-800 p-5 space-y-4" title="Thông Tin Pháp Lý Doanh Nghiệp (Master Organization)">
            <form onSubmit={handleSaveCompanyProfile} className="space-y-4">
              <fieldset disabled={!canEditCompanyProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput label="Tên Doanh Nghiệp Pháp Lý" required className="font-bold" value={companyProfile.companyName}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, companyName: e.target.value })} />
                <TextInput label="Tên Thương Hiệu Viết Tắt" value={companyProfile.shortName}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, shortName: e.target.value })} />
                <TextInput label="Mã Số Thuế (MST)" required className="font-mono" value={companyProfile.taxCode}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, taxCode: e.target.value })} />
                <TextInput label="Hotline / Số Điện Thoại" value={companyProfile.phone}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, phone: e.target.value })} />
                <TextInput label="Địa Chỉ Trụ Sở Chính" required wrapperClassName="md:col-span-2" value={companyProfile.address}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, address: e.target.value })} />
                <TextInput label="Email" type="email" value={companyProfile.email}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, email: e.target.value })} />
                <TextInput label="Website" value={companyProfile.website}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, website: e.target.value })} />
                <TextInput label="Người Đại Diện Pháp Luật" value={companyProfile.legalRepresentative}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, legalRepresentative: e.target.value })} />
                <TextInput label="Kế Toán Trưởng" value={companyProfile.chiefAccountant}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, chiefAccountant: e.target.value })} />
              </fieldset>

              {canEditCompanyProfile && (
                <div className="pt-2 flex justify-end">
                  <Button type="submit" size="sm" icon={<Save className="h-3.5 w-3.5" />}>Lưu Thông Tin Doanh Nghiệp</Button>
                </div>
              )}
            </form>
          </Card>
        </div>
      )}
      {/* Tab 9: System Schema Viewer sys_* */}
      {activeTab === 'sys_schema' && (
        <SystemSchemaViewer />
      )}

      {/* Tab 10: i18n Database & C# API */}
      {activeTab === 'i18n_db' && (
        <I18nDbManager />
      )}

      {/* Tab 11: Data Backup, Import & Reset */}
      {activeTab === 'data_management' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Card */}
            <Card className="p-5 border border-slate-200 dark:border-slate-800 rounded-[5px] space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <Download className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Sao Lưu Cấu Hình Hệ Thống (Export JSON)
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Trích xuất toàn bộ cấu hình tham số mặc định, năm tài chính, danh mục ngoại tệ, tỷ giá và thông tin pháp lý doanh nghiệp ra tệp tin JSON an toàn.
              </p>
              <Button
                size="sm"
                variant="primary"
                onClick={handleExportConfig}
                icon={<Download className="h-3.5 w-3.5" />}
                className="rounded-[5px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                Tải Xuống File Cấu Hình (.JSON)
              </Button>
            </Card>

            {/* Import Card */}
            <Card className="p-5 border border-slate-200 dark:border-slate-800 rounded-[5px] space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <Upload className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Phục Hồi Cấu Hình Hệ Thống (Import JSON)
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Nhập lại cấu hình tham số, quy tắc đánh số chứng từ và các thiết lập đã sao lưu từ trước từ chuỗi hoặc tệp JSON.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsImportModalOpen(true)}
                icon={<Upload className="h-3.5 w-3.5" />}
                className="rounded-[5px]"
              >
                Nhập Cấu Hình Từ JSON
              </Button>
            </Card>
          </div>

          {/* Reset System Card */}
          <Card className="p-5 border border-rose-200 dark:border-rose-900/60 rounded-[5px] space-y-4 bg-rose-50/20 dark:bg-rose-950/10">
            <div className="flex items-center gap-2 pb-2 border-b border-rose-200 dark:border-rose-900/60">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">
                Khôi Phục Toàn Bộ Cơ Sở Dữ Liệu Về Mặc Định (Factory Reset)
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Thao tác này sẽ xóa toàn bộ các thay đổi cục bộ trong trình duyệt (danh mục vật tư mới, chứng từ phát sinh, phiếu xuất nhập) và nạp lại toàn bộ kho dữ liệu mẫu chuẩn của hệ thống ERP.
            </p>
            <div>
              <Button
                variant="danger"
                size="sm"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={() => void handleResetAll()}
                className="rounded-[5px]"
              >
                Khôi Phục Dữ Liệu Mẫu ERP Ban Đầu
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal Import JSON */}
      {isImportModalOpen && (
        <Modal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          title="Nhập Dữ Liệu Cấu Hình Từ JSON"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-400">
              Dán nội dung JSON đã xuất từ hệ thống vào khung dưới đây:
            </p>
            <TextArea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Dán chuỗi JSON cấu hình vào đây..."
              className="font-mono text-[11px]"
            />
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(false)} className="rounded-[5px]">
                Hủy
              </Button>
              <Button variant="primary" size="sm" onClick={handleImportConfig} className="rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Áp Dụng Cấu Hình
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};
