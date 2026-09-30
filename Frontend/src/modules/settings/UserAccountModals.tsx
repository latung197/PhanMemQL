// Forms of Settings › Người dùng & Phân quyền: create account, edit account, create role.
import React, { useMemo, useState } from 'react';
import { Building2, KeyRound, Save, ShieldCheck, Sparkles, UserPlus, UserRound } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Checkbox } from '../../components/common/Checkbox';
import { FormSection, PasswordInput, SelectInput, TextArea, TextInput } from '../../components/common/FormField';
import { CompanyUnit, RoleDefinition, UserProfile } from '../../types';
import { rolesApi, usersApi } from '../../services/settingsApi';
import { getErrorMessage } from '../../services/apiClient';
import { showToast } from '../../utils/toast';
import { countViewable, toFullMatrix } from './permissions/permissionCatalog';

export const DEPARTMENTS = ['Ban Giám Đốc', 'Phòng Kế Toán', 'Phòng Kinh Doanh', 'Phòng Kho Vận', 'Phòng Nhân Sự', 'Phòng Kỹ Thuật & IT'];

/** Same rule as the backend (UserService): lowercase letters, digits, ".", "_" or "-". */
const USERNAME_PATTERN = /^[a-z0-9._-]{3,50}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

type FieldErrors = Partial<Record<'username' | 'password' | 'confirmPassword' | 'fullName' | 'email' | 'employeeCode' | 'defaultUnit', string>>;

/** Puts a backend message on the field it is about, so it shows next to that input. */
const fieldOfServerError = (message: string): keyof FieldErrors | null => {
  const m = message.toLowerCase();
  if (m.includes('tên đăng nhập')) return 'username';
  if (m.includes('mật khẩu')) return 'password';
  if (m.includes('email')) return 'email';
  if (m.includes('mã nhân viên')) return 'employeeCode';
  if (m.includes('họ tên')) return 'fullName';
  if (m.includes('đơn vị')) return 'defaultUnit';
  return null;
};

/** Readable random password: no look-alike characters, always a digit and a symbol. */
const generatePassword = (): string => {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const random = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  const body = Array.from({ length: 8 }, () => random(letters)).join('');
  return `${body}${random('23456789')}${random('23456789')}${random('@#$%')}`;
};

const useServerErrors = (setErrors: React.Dispatch<React.SetStateAction<FieldErrors>>) =>
  (error: unknown) => {
    const message = getErrorMessage(error);
    const field = fieldOfServerError(message);
    if (field) setErrors(prev => ({ ...prev, [field]: message }));
    showToast.error(message);
  };

/** Default unit + the other units the account may sign in to. */
const UnitAccessFields: React.FC<{
  units: CompanyUnit[];
  defaultUnit: string;
  allowed: string[];
  error?: string;
  onDefaultUnitChange: (code: string) => void;
  onAllowedChange: (codes: string[]) => void;
}> = ({ units, defaultUnit, allowed, error, onDefaultUnitChange, onAllowedChange }) => {
  const selected = new Set([defaultUnit, ...allowed]);
  const allSelected = units.every(u => selected.has(u.code));
  return (
    <div className="space-y-2">
      <SelectInput label="Đơn vị làm việc mặc định" required value={defaultUnit} error={error}
        hint="Đơn vị được chọn sẵn khi đăng nhập"
        onChange={(e) => onDefaultUnitChange(e.target.value)}
        options={units.map(u => ({ value: u.code, label: `${u.code} - ${u.name}` }))} />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Được phép đăng nhập vào</span>
          <button type="button" className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            onClick={() => onAllowedChange(allSelected ? [] : units.map(u => u.code))}>
            {allSelected ? 'Chỉ đơn vị mặc định' : 'Chọn tất cả'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 rounded-[5px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          {units.map(u => (
            <Checkbox
              key={u.code}
              checked={selected.has(u.code)}
              disabled={u.code === defaultUnit}
              label={`${u.code} - ${u.shortName || u.name}`}
              subLabel={u.code === defaultUnit ? 'Đơn vị mặc định' : undefined}
              onChange={(on) => onAllowedChange(on ? [...allowed, u.code] : allowed.filter(code => code !== u.code))}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/** Role select with a short preview of what the role grants. */
const RolePicker: React.FC<{ roles: RoleDefinition[]; value: string; onChange: (id: string) => void }> = ({ roles, value, onChange }) => {
  const role = roles.find(r => r.id === value);
  const viewable = role ? countViewable(toFullMatrix({ isSystemAdmin: role.isSystemRole, permissions: role.permissions })) : 0;
  return (
    <div className="space-y-1.5">
      <SelectInput label="Vai trò" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="— Chưa gán vai trò (không có quyền) —"
        options={roles.map(r => ({ value: r.id, label: `${r.name} [${r.code}]` }))} />
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {role
          ? <>{role.isSystemRole ? 'Toàn quyền trên mọi chức năng.' : `Được xem ${viewable} chức năng.`} {role.description}</>
          : 'Tài khoản chưa có quyền nào cho đến khi được gán vai trò hoặc cấp quyền riêng.'}
      </p>
    </div>
  );
};

export const CreateUserModal: React.FC<{
  roles: RoleDefinition[];
  units: CompanyUnit[];
  defaultUnitCode: string;
  suggestedEmployeeCode: string;
  onClose: () => void;
  onCreated: (user: UserProfile) => void;
}> = ({ roles, units, defaultUnitCode, suggestedEmployeeCode, onClose, onCreated }) => {
  const [form, setForm] = useState({
    username: '', password: '', confirmPassword: '', fullName: '', employeeCode: suggestedEmployeeCode,
    email: '', phone: '', department: '', roleId: roles.find(r => !r.isSystemRole)?.id || '',
    defaultUnit: defaultUnitCode || units[0]?.code || '', allowedUnits: [] as string[]
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const onServerError = useServerErrors(setErrors);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!USERNAME_PATTERN.test(form.username.trim()))
      e.username = 'Từ 3–50 ký tự, chỉ gồm chữ thường không dấu, số và . _ -';
    if (form.password.length < MIN_PASSWORD) e.password = `Tối thiểu ${MIN_PASSWORD} ký tự`;
    if (form.confirmPassword !== form.password) e.confirmPassword = 'Mật khẩu nhập lại không khớp';
    if (!form.fullName.trim()) e.fullName = 'Vui lòng nhập họ và tên';
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) e.email = 'Email không hợp lệ';
    if (!form.defaultUnit) e.defaultUnit = 'Vui lòng chọn đơn vị làm việc';
    return e;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      onCreated(await usersApi.create({
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        department: form.department.trim() || undefined,
        employeeCode: form.employeeCode.trim() || undefined,
        roleId: form.roleId || null,
        ma_dvcs: form.defaultUnit,
        ds_ma_dvcs: form.allowedUnits
      }));
    } catch (error) {
      onServerError(error);
    } finally {
      setSaving(false);
    }
  };

  const fillGeneratedPassword = () => {
    const password = generatePassword();
    setForm(prev => ({ ...prev, password, confirmPassword: password }));
    setErrors(prev => ({ ...prev, password: undefined, confirmPassword: undefined }));
    showToast.info('Đã tạo mật khẩu ngẫu nhiên. Bấm biểu tượng con mắt để xem và gửi cho nhân viên.');
  };

  return (
    <Modal isOpen onClose={onClose} maxWidth="3xl" title={<><UserPlus className="h-5 w-5 text-indigo-600" /> Thêm Người Dùng</>}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <FormSection icon={<KeyRound />} title="Tài khoản đăng nhập"
          description="Thông tin nhân viên dùng để đăng nhập hệ thống"
          action={<Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={fillGeneratedPassword}
            icon={<Sparkles className="h-3.5 w-3.5 text-indigo-500" />}>Tạo mật khẩu</Button>}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TextInput label="Tên đăng nhập" required autoFocus autoComplete="off" placeholder="vd: hung.pham"
              value={form.username} error={errors.username} hint="Chữ thường không dấu, số và . _ -"
              onChange={(e) => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))} />
            <PasswordInput label="Mật khẩu ban đầu" required autoComplete="new-password"
              value={form.password} error={errors.password} hint={`Tối thiểu ${MIN_PASSWORD} ký tự`}
              onChange={(e) => set('password', e.target.value)} />
            <PasswordInput label="Nhập lại mật khẩu" required autoComplete="new-password"
              value={form.confirmPassword} error={errors.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)} />
          </div>
        </FormSection>

        <FormSection icon={<UserRound />} title="Thông tin nhân viên">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TextInput label="Họ và tên" required wrapperClassName="md:col-span-2" value={form.fullName} error={errors.fullName}
              onChange={(e) => set('fullName', e.target.value)} />
            <TextInput label="Mã nhân viên" className="font-mono" value={form.employeeCode} error={errors.employeeCode}
              onChange={(e) => set('employeeCode', e.target.value.toUpperCase())} />
            <TextInput label="Email" type="email" value={form.email} error={errors.email}
              onChange={(e) => set('email', e.target.value)} />
            <TextInput label="Số điện thoại" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            <TextInput label="Phòng ban" list="erp-departments" placeholder="Chọn hoặc nhập" value={form.department}
              onChange={(e) => set('department', e.target.value)} />
            <datalist id="erp-departments">{DEPARTMENTS.map(d => <option key={d} value={d} />)}</datalist>
          </div>
        </FormSection>

        <FormSection icon={<ShieldCheck />} title="Phân quyền & đơn vị làm việc"
          description="Quyền chi tiết có thể tinh chỉnh ở bảng phân quyền sau khi tạo">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RolePicker roles={roles} value={form.roleId} onChange={(id) => set('roleId', id)} />
            <UnitAccessFields units={units} defaultUnit={form.defaultUnit} allowed={form.allowedUnits} error={errors.defaultUnit}
              onDefaultUnitChange={(code) => set('defaultUnit', code)} onAllowedChange={(codes) => set('allowedUnits', codes)} />
          </div>
        </FormSection>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>Hủy</Button>
          <Button type="submit" size="sm" disabled={saving} icon={<Save className="h-3.5 w-3.5" />}>
            {saving ? 'Đang tạo...' : 'Tạo người dùng'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export const EditUserModal: React.FC<{
  user: UserProfile;
  units: CompanyUnit[];
  isSelf: boolean;
  onClose: () => void;
  onSaved: (user: UserProfile) => void;
}> = ({ user, units, isSelf, onClose, onSaved }) => {
  const [form, setForm] = useState({
    fullName: user.fullName, employeeCode: user.employeeCode || '', email: user.email, phone: user.phone,
    department: user.department, isActive: user.isActive !== false,
    defaultUnit: user.ma_dvcs || units[0]?.code || '', allowedUnits: user.ds_ma_dvcs || []
  });
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const onServerError = useServerErrors(setErrors);
  const lockingSelf = useMemo(() => isSelf && !form.isActive, [isSelf, form.isActive]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: FieldErrors = {};
    if (!form.fullName.trim()) found.fullName = 'Vui lòng nhập họ và tên';
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) found.email = 'Email không hợp lệ';
    setErrors(found);
    if (Object.keys(found).length > 0 || lockingSelf) return;
    setSaving(true);
    try {
      onSaved(await usersApi.update(user.id, {
        fullName: form.fullName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        department: form.department.trim() || undefined,
        avatar: user.avatar,
        themePref: user.themePref,
        notificationsEnabled: user.notificationsEnabled,
        employeeCode: form.employeeCode.trim() || undefined,
        isActive: form.isActive,
        ma_dvcs: form.defaultUnit,
        ds_ma_dvcs: form.allowedUnits
      }));
    } catch (error) {
      onServerError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < MIN_PASSWORD) {
      setErrors(prev => ({ ...prev, password: `Tối thiểu ${MIN_PASSWORD} ký tự` }));
      return;
    }
    setSaving(true);
    try {
      await usersApi.resetPassword(user.id, newPassword);
      setNewPassword('');
      showToast.success(`Đã đặt lại mật khẩu cho @${user.username}. Các phiên đăng nhập cũ đã bị đăng xuất.`);
    } catch (error) {
      onServerError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} maxWidth="3xl" title={<><UserRound className="h-5 w-5 text-indigo-600" /> Sửa Tài Khoản @{user.username}</>}>
      <div className="space-y-3">
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <FormSection icon={<UserRound />} title="Thông tin nhân viên">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <TextInput label="Họ và tên" required wrapperClassName="md:col-span-2" value={form.fullName} error={errors.fullName}
                onChange={(e) => set('fullName', e.target.value)} />
              <TextInput label="Mã nhân viên" className="font-mono" value={form.employeeCode} error={errors.employeeCode}
                onChange={(e) => set('employeeCode', e.target.value.toUpperCase())} />
              <TextInput label="Email" type="email" value={form.email} error={errors.email} onChange={(e) => set('email', e.target.value)} />
              <TextInput label="Số điện thoại" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              <TextInput label="Phòng ban" list="erp-departments-edit" value={form.department}
                onChange={(e) => set('department', e.target.value)} />
              <datalist id="erp-departments-edit">{DEPARTMENTS.map(d => <option key={d} value={d} />)}</datalist>
            </div>
          </FormSection>

          <FormSection icon={<Building2 />} title="Đơn vị làm việc & trạng thái">
            <UnitAccessFields units={units} defaultUnit={form.defaultUnit} allowed={form.allowedUnits} error={errors.defaultUnit}
              onDefaultUnitChange={(code) => set('defaultUnit', code)} onAllowedChange={(codes) => set('allowedUnits', codes)} />
            <Checkbox
              checked={form.isActive}
              disabled={isSelf}
              onChange={(on) => set('isActive', on)}
              label="Tài khoản đang hoạt động"
              subLabel={isSelf ? 'Không thể tự khóa tài khoản đang đăng nhập' : 'Bỏ chọn để khóa: tài khoản sẽ bị đăng xuất và không đăng nhập được'}
            />
          </FormSection>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>Đóng</Button>
            <Button type="submit" size="sm" disabled={saving} icon={<Save className="h-3.5 w-3.5" />}>Lưu tài khoản</Button>
          </div>
        </form>

        {isSelf ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> Đổi mật khẩu của chính bạn tại menu tài khoản › "Đổi mật khẩu".
          </p>
        ) : (
        <FormSection icon={<KeyRound />} title="Đặt lại mật khẩu"
          description="Dùng khi nhân viên quên mật khẩu. Các phiên đăng nhập hiện có của tài khoản sẽ bị đăng xuất.">
          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
            <PasswordInput wrapperClassName="grow" autoComplete="new-password" placeholder={`Mật khẩu mới, tối thiểu ${MIN_PASSWORD} ký tự`}
              value={newPassword} error={errors.password}
              onChange={(e) => { setNewPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })); }} />
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setNewPassword(generatePassword())}
              icon={<Sparkles className="h-3.5 w-3.5 text-indigo-500" />}>Tạo ngẫu nhiên</Button>
            <Button type="button" variant="outline" size="sm" className="h-8" disabled={saving} onClick={() => void handleResetPassword()}
              icon={<KeyRound className="h-3.5 w-3.5" />}>Đặt lại</Button>
          </div>
        </FormSection>
        )}
      </div>
    </Modal>
  );
};

export const CreateRoleModal: React.FC<{
  roles: RoleDefinition[];
  onClose: () => void;
  onCreated: (role: RoleDefinition) => void;
}> = ({ roles, onClose, onCreated }) => {
  const templates = roles.filter(r => !r.isSystemRole);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseRoleId, setBaseRoleId] = useState(templates[0]?.id || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const base = roles.find(r => r.id === baseRoleId);
    setSaving(true);
    try {
      onCreated(await rolesApi.create({
        code: code.trim().toUpperCase(), name: name.trim(), description: description.trim(),
        permissions: base ? base.permissions : {},
        specialRights: base?.specialRights ?? []
      }));
    } catch (error) {
      showToast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} maxWidth="lg" title={<><ShieldCheck className="h-5 w-5 text-indigo-600" /> Thêm Vai Trò</>}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TextInput label="Mã vai trò" required autoFocus className="font-mono uppercase" value={code} placeholder="vd: KT_TT"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, '_'))} />
          <TextInput label="Tên vai trò" required wrapperClassName="sm:col-span-2" value={name} placeholder="vd: Kế toán thanh toán"
            onChange={(e) => setName(e.target.value)} />
        </div>
        <SelectInput label="Sao chép quyền từ vai trò" value={baseRoleId} onChange={(e) => setBaseRoleId(e.target.value)}
          placeholder="— Không sao chép (chưa có quyền) —" hint="Có thể chỉnh lại ma trận quyền sau khi tạo"
          options={templates.map(r => ({ value: r.id, label: `${r.name} [${r.code}]` }))} />
        <TextArea label="Mô tả nhiệm vụ" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>Hủy</Button>
          <Button type="submit" size="sm" disabled={saving} icon={<Save className="h-3.5 w-3.5" />}>Tạo vai trò</Button>
        </div>
      </form>
    </Modal>
  );
};
