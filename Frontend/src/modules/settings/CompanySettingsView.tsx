// Settings › Hồ sơ doanh nghiệp & sao lưu (settings_main): the company legal profile for everybody who may
// view it; backup / restore of all settings and the demo tools for administrators only.
import React, { useRef, useState } from 'react';
import { AlertTriangle, Database, Download, Languages, Landmark, RotateCcw, Save, Server, Upload } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Tabs } from '../../components/common/Tabs';
import { TextInput } from '../../components/common/FormField';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { CompanyProfileConfig, systemSettingsService } from '../../services/systemSettingsService';
import { SettingsBackup, settingsBackupApi } from '../../services/settingsApi';
import { getErrorMessage } from '../../services/apiClient';
import { saveWithFeedback, showToast } from '../../utils/toast';
import { UserProfile } from '../../types';
import { SystemSchemaViewer } from '../system/SystemSchemaViewer';
import { I18nDbManager } from './I18nDbManager';
import { SettingsViewProps } from './settingsTypes';

type Section = 'profile' | 'backup' | 'schema' | 'i18n';

interface CompanySettingsViewProps extends SettingsViewProps {
  user: UserProfile;
  /** Reloads the demo business data kept in this browser (modules not on the backend yet). */
  onResetData: () => void;
}

export const CompanySettingsView: React.FC<CompanySettingsViewProps> = ({ canEdit, user, onResetData }) => {
  const isAdmin = !!user.isSystemAdmin;
  const [section, setSection] = useState<Section>('profile');

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Tabs value={section} onChange={setSection} items={[
          { key: 'profile', label: 'Hồ sơ doanh nghiệp', icon: <Landmark /> },
          { key: 'backup', label: 'Sao lưu & phục hồi', icon: <Server />, tone: 'rose' },
          { key: 'schema', label: 'Từ điển sys_* (tham khảo)', icon: <Database />, tone: 'purple' },
          { key: 'i18n', label: 'Đa ngôn ngữ (mô phỏng)', icon: <Languages />, tone: 'blue' }
        ]} />
      )}
      {section === 'profile' && <CompanyProfileForm canEdit={canEdit} />}
      {isAdmin && section === 'backup' && <BackupPanel onResetData={onResetData} />}
      {isAdmin && section === 'schema' && <SystemSchemaViewer />}
      {isAdmin && section === 'i18n' && <I18nDbManager />}
    </div>
  );
};

const CompanyProfileForm: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const [profile, setProfile] = useState<CompanyProfileConfig>(() => systemSettingsService.getCompanyProfile());
  const field = (key: keyof CompanyProfileConfig) => ({
    value: profile[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, [key]: e.target.value })
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void saveWithFeedback(systemSettingsService.saveCompanyProfile(profile),
      () => showToast.success('Đã lưu thông tin doanh nghiệp'));
  };

  return (
    <Card className="rounded-[5px] border border-slate-200 dark:border-slate-800 p-5" title="Thông tin pháp lý doanh nghiệp">
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={!canEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextInput label="Tên doanh nghiệp" required className="font-bold" {...field('companyName')} />
          <TextInput label="Tên viết tắt" {...field('shortName')} />
          <TextInput label="Mã số thuế" required className="font-mono" {...field('taxCode')} />
          <TextInput label="Điện thoại" {...field('phone')} />
          <TextInput label="Địa chỉ trụ sở" required wrapperClassName="md:col-span-2" {...field('address')} />
          <TextInput label="Email" type="email" {...field('email')} />
          <TextInput label="Website" {...field('website')} />
          <TextInput label="Người đại diện pháp luật" {...field('legalRepresentative')} />
          <TextInput label="Kế toán trưởng" {...field('chiefAccountant')} />
        </fieldset>
        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" size="sm" icon={<Save className="h-3.5 w-3.5" />}>Lưu thông tin doanh nghiệp</Button>
          </div>
        )}
      </form>
    </Card>
  );
};

const BackupPanel: React.FC<{ onResetData: () => void }> = ({ onResetData }) => {
  const confirm = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const backup = await settingsBackupApi.export();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `s-erp-cai-dat-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast.success('Đã tải file sao lưu cài đặt');
    } catch (e) {
      showToast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (file: File) => {
    let backup: SettingsBackup;
    try {
      backup = JSON.parse(await file.text()) as SettingsBackup;
    } catch {
      showToast.error('File không phải JSON hợp lệ.');
      return;
    }
    if (!(await confirm({
      title: 'Phục hồi cài đặt từ file?',
      message: `Tham số, ngoại tệ (${backup.currencies?.length ?? 0}), tỷ giá (${backup.exchangeRates?.length ?? 0}), phòng ban (${backup.departments?.length ?? 0}) và cách đánh số chứng từ trong file sẽ được ghi đè lên dữ liệu hiện tại. Dữ liệu không có trong file được giữ nguyên. Nếu có lỗi, không có gì bị thay đổi.`,
      confirmLabel: 'Phục hồi',
      tone: 'warning'
    }))) return;
    setBusy(true);
    try {
      await settingsBackupApi.restore(backup);
      await systemSettingsService.load();
      showToast.success('Đã phục hồi cài đặt. Tải lại trang để áp dụng ở mọi màn hình.');
    } catch (e) {
      showToast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const resetDemo = async () => {
    if (await confirm({
      title: 'Nạp lại dữ liệu mẫu trong trình duyệt?',
      message: 'Chỉ ảnh hưởng dữ liệu mẫu của các phân hệ chưa nối backend (vật tư, phiếu kho, bán hàng, tài chính, nhân sự) trên trình duyệt này. Người dùng, phân quyền và cài đặt hệ thống không bị thay đổi.',
      confirmLabel: 'Nạp lại',
      tone: 'danger'
    })) onResetData();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3 border border-slate-200 dark:border-slate-800 rounded-[5px]" title="Sao lưu cài đặt">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Tải về một file JSON gồm tham số mặc định, năm tài chính, hồ sơ doanh nghiệp, định dạng số, ngoại tệ, tỷ giá,
          phòng ban và cách đánh số chứng từ. Không gồm người dùng và phân quyền.
        </p>
        <Button size="sm" disabled={busy} onClick={() => void download()} icon={<Download className="h-3.5 w-3.5" />}>Tải file sao lưu</Button>
      </Card>

      <Card className="p-5 space-y-3 border border-slate-200 dark:border-slate-800 rounded-[5px]" title="Phục hồi cài đặt">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Chọn file đã sao lưu. Toàn bộ file được áp dụng trong một lần: lỗi ở bất kỳ mục nào thì không có gì bị thay đổi.
        </p>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden"
          onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void restore(file); }} />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()} icon={<Upload className="h-3.5 w-3.5" />}>
          Chọn file và phục hồi
        </Button>
      </Card>

      <Card className="md:col-span-2 p-5 space-y-3 border border-rose-200 dark:border-rose-900/60 rounded-[5px]">
        <div className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4" /> Dữ liệu mẫu trong trình duyệt
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Các phân hệ nghiệp vụ chưa nối backend đang dùng dữ liệu mẫu lưu trong trình duyệt. Nạp lại để quay về dữ liệu mẫu ban đầu.
        </p>
        <Button variant="danger" size="sm" onClick={() => void resetDemo()} icon={<RotateCcw className="h-3.5 w-3.5" />}>
          Nạp lại dữ liệu mẫu
        </Button>
      </Card>
    </div>
  );
};
