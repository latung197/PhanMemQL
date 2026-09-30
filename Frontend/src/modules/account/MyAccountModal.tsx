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
  const [tab, setTab] = useState<MyAccountTab>(initialTab);

  return (
    <Modal isOpen onClose={onClose} maxWidth="2xl" title={<><UserRound className="h-5 w-5 text-indigo-600" /> Tài Khoản Của Tôi</>}>
      <div className="space-y-4">
        <AccountSummary user={user} companyUnits={companyUnits} />
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'profile', label: 'Thông tin tài khoản', icon: <UserRound /> },
            { key: 'password', label: 'Đổi mật khẩu', icon: <KeyRound /> }
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
  const unitName = (code?: string) => companyUnits.find(u => u.code === code)?.shortName || code || '—';
  return (
    <div className="flex items-center gap-3 p-3 rounded-[5px] bg-brand-50 dark:bg-slate-800/60 border border-brand-200 dark:border-slate-700">
      <span className="h-12 w-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-lg shrink-0">
        {user.fullName.charAt(0)}
      </span>
      <div className="min-w-0 text-xs space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{user.fullName}</span>
          <Badge variant={user.isSystemAdmin ? 'warning' : 'indigo'} size="sm">{user.role || 'Chưa gán vai trò'}</Badge>
        </div>
        <p className="text-slate-500 dark:text-slate-400">
          @{user.username}{user.employeeCode && <> · Mã NV <span className="font-mono">{user.employeeCode}</span></>}
        </p>
        <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-wrap">
          <Building2 className="h-3 w-3" /> Đang làm việc tại <strong className="text-slate-700 dark:text-slate-300">{unitName(user.ma_dvcs)}</strong>
          · Được vào: {(user.ds_ma_dvcs ?? []).map(unitName).join(', ') || '—'}
        </p>
      </div>
    </div>
  );
};

const ProfileForm: React.FC<{ user: UserProfile; onSaved: (user: UserProfile) => void }> = ({ user, onSaved }) => {
  const { theme, toggleTheme } = useTheme();
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
    }).then(onSaved), () => showToast.success('Đã cập nhật thông tin tài khoản'));
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextInput label="Họ và tên" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <TextInput label="Tên đăng nhập" readOnly value={user.username} hint="Không thể thay đổi" />
        <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextInput label="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <TextInput label="Phòng ban" readOnly value={user.department || 'Chưa gán phòng ban'} hint="Do quản trị viên khai báo" />
        <TextInput label="Vai trò" readOnly value={user.role || 'Chưa gán vai trò'} hint="Do quản trị viên phân quyền" />
      </div>
      <Checkbox label="Hiện thông báo nổi khi có thông báo mới" checked={notificationsEnabled}
        onChange={setNotificationsEnabled}
        subLabel="Tắt thì thông báo vẫn nằm trong chuông, chỉ không bật lên góc màn hình" />
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={toggleTheme}
          icon={theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5" />}>
          {theme === 'dark' ? 'Giao diện tối' : 'Giao diện sáng'}
        </Button>
        <Button type="submit" size="sm" disabled={saving} icon={<Save className="h-3.5 w-3.5" />}>
          {saving ? 'Đang lưu...' : 'Lưu thông tin'}
        </Button>
      </div>
    </form>
  );
};

const PasswordForm: React.FC<{ onChanged: (user: UserProfile) => void }> = ({ onChanged }) => {
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
      () => showToast.success('Đã đổi mật khẩu. Các phiên đăng nhập khác của tài khoản đã bị đăng xuất.'));
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
      <TextInput label="Mật khẩu hiện tại" type="password" required autoComplete="current-password"
        value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      <TextInput label="Mật khẩu mới" type="password" required minLength={8} autoComplete="new-password"
        hint="Tối thiểu 8 ký tự" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      <TextInput label="Nhập lại mật khẩu mới" type="password" required minLength={8} autoComplete="new-password"
        value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
        error={mismatch ? 'Mật khẩu nhập lại không khớp' : undefined} />
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Sau khi đổi, các thiết bị khác đang đăng nhập bằng tài khoản này sẽ phải đăng nhập lại.
      </p>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving || mismatch} icon={<Lock className="h-3.5 w-3.5" />}>
          {saving ? 'Đang đổi...' : 'Đổi mật khẩu'}
        </Button>
      </div>
    </form>
  );
};
