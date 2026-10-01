// The signed-in user's own account: profile and password. Opened from the header user menu.
import React, { useState } from 'react';
import { Building2, KeyRound, Lock, Moon, Save, Sun, UserRound } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Checkbox } from '../../components/common/Checkbox';
import { Tabs } from '../../components/common/Tabs';
import { TextInput } from '../../components/common/FormField';
import { CompanyUnit, UserProfile } from '../../types';
import { authService } from '../../services/authService';
import { useTheme } from '../../context/ThemeContext';
import { saveWithFeedback, showToast } from '../../utils/toast';
import { useLanguage } from '../../context/LanguageContext';

export type MyAccountTab = 'profile' | 'password';

interface MyAccountModalProps {
  user: UserProfile;
  companyUnits: CompanyUnit[];
  initialTab: MyAccountTab;
  onClose: () => void;
  /** Receives the updated profile (after saving it or changing the password). */
  onUserUpdated: (user: UserProfile) => void;
}

export const MyAccountModal: React.FC<MyAccountModalProps> = ({ user, companyUnits, initialTab, onClose, onUserUpdated }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<MyAccountTab>(initialTab);

  return (
    <Modal isOpen onClose={onClose} maxWidth="2xl" title={<><UserRound className="h-5 w-5 text-indigo-600" /> {t('account.title')}</>}>
      <div className="space-y-4">
        <AccountSummary user={user} companyUnits={companyUnits} />
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'profile', label: t('account.tabProfile'), icon: <UserRound /> },
            { key: 'password', label: t('account.tabPassword'), icon: <KeyRound /> }
          ]}
        />
        {tab === 'profile'
          ? <ProfileForm user={user} onSaved={onUserUpdated} />
          : <PasswordForm onChanged={(u) => { onUserUpdated(u); onClose(); }} />}
      </div>
    </Modal>
  );
};

const AccountSummary: React.FC<{ user: UserProfile; companyUnits: CompanyUnit[] }> = ({ user, companyUnits }) => {
  const { t } = useLanguage();
  const unitName = (code?: string) => companyUnits.find(u => u.code === code)?.shortName || code || '—';
  return (
    <div className="flex items-center gap-3 p-3 rounded-[5px] bg-brand-50 dark:bg-slate-800/60 border border-brand-200 dark:border-slate-700">
      <span className="h-12 w-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-lg shrink-0">
        {user.fullName.charAt(0)}
      </span>
      <div className="min-w-0 text-xs space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{user.fullName}</span>
          <Badge variant={user.isSystemAdmin ? 'warning' : 'indigo'} size="sm">{user.role || t('account.noRole')}</Badge>
        </div>
        <p className="text-slate-500 dark:text-slate-400">
          @{user.username}{user.employeeCode && <> · {t('account.employeeCode')} <span className="font-mono">{user.employeeCode}</span></>}
        </p>
        <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-wrap">
          <Building2 className="h-3 w-3" /> {t('account.workingAt')} <strong className="text-slate-700 dark:text-slate-300">{unitName(user.ma_dvcs)}</strong>
          · {t('account.allowedUnits')} {(user.ds_ma_dvcs ?? []).map(unitName).join(', ') || '—'}
        </p>
      </div>
    </div>
  );
};

const ProfileForm: React.FC<{ user: UserProfile; onSaved: (user: UserProfile) => void }> = ({ user, onSaved }) => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [notificationsEnabled, setNotificationsEnabled] = useState(user.notificationsEnabled !== false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await saveWithFeedback(authService.updateMyProfile({
      fullName: fullName.trim(), email: email.trim(), phone: phone.trim(),
      avatar: user.avatar, themePref: theme, notificationsEnabled
    }).then(onSaved), () => showToast.success(t('account.profileSaved')));
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextInput label={t('account.fullName')} required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <TextInput label={t('account.username')} readOnly value={user.username} hint={t('account.cannotChange')} />
        <TextInput label={t('account.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextInput label={t('account.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <TextInput label={t('account.department')} readOnly value={user.department || t('account.noDepartment')} hint={t('account.setByAdmin')} />
        <TextInput label={t('account.role')} readOnly value={user.role || t('account.noRole')} hint={t('account.setByPermission')} />
      </div>
      <Checkbox label={t('account.popupNotifications')} checked={notificationsEnabled}
        onChange={setNotificationsEnabled}
        subLabel={t('account.popupNotificationsHint')} />
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={toggleTheme}
          icon={theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5" />}>
          {theme === 'dark' ? t('account.darkTheme') : t('account.lightTheme')}
        </Button>
        <Button type="submit" size="sm" disabled={saving} icon={<Save className="h-3.5 w-3.5" />}>
          {saving ? t('account.saving') : t('account.saveProfile')}
        </Button>
      </div>
    </form>
  );
};

const PasswordForm: React.FC<{ onChanged: (user: UserProfile) => void }> = ({ onChanged }) => {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setSaving(true);
    await saveWithFeedback(authService.changePassword(currentPassword, newPassword).then(onChanged),
      () => showToast.success(t('account.passwordChanged')));
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
      <TextInput label={t('account.currentPassword')} type="password" required autoComplete="current-password"
        value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      <TextInput label={t('account.newPassword')} type="password" required minLength={8} autoComplete="new-password"
        hint={t('account.newPasswordHint')} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      <TextInput label={t('account.confirmPassword')} type="password" required minLength={8} autoComplete="new-password"
        value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
        error={mismatch ? t('account.passwordMismatch') : undefined} />
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {t('account.passwordNote')}
      </p>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving || mismatch} icon={<Lock className="h-3.5 w-3.5" />}>
          {saving ? t('account.changing') : t('account.changePassword')}
        </Button>
      </div>
    </form>
  );
};
