// Forms of Settings › Người dùng & Phân quyền: create account, edit account, create role.
import React, { useMemo, useState } from 'react';
import { Building2, KeyRound, Save, ShieldCheck, Sparkles, UserPlus, UserRound } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Checkbox } from '../../components/common/Checkbox';
import { FormSection, PasswordInput, SelectInput, TextArea, TextInput } from '../../components/common/FormField';
import { CompanyUnit, RoleDefinition, UserProfile } from '../../types';
import { DepartmentOption, rolesApi, usersApi } from '../../services/settingsApi';
import { getErrorMessage } from '../../services/apiClient';
import { showToast } from '../../utils/toast';
import { countViewable, toFullMatrix } from './permissions/permissionCatalog';
import { useLanguage } from '../../context/LanguageContext';
import { translate } from '../../utils/i18n';

/** Department picker; inactive departments are only listed when already selected. */
const DepartmentSelect: React.FC<{ departments: DepartmentOption[]; value: string; onChange: (code: string) => void }> = ({ departments, value, onChange }) => {
  const { t } = useLanguage();
  return (
    <SelectInput label={t('users.form.department')} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={t('users.form.noDepartment')}
      options={departments.filter(d => d.isActive || d.code === value).map(d => ({ value: d.code, label: d.name }))} />
  );
};

/** Same rule as the backend (UserService): lowercase letters, digits, ".", "_" or "-". */
const USERNAME_PATTERN = /^[a-z0-9._-]{3,50}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

type FieldErrors = Partial<Record<'username' | 'password' | 'confirmPassword' | 'fullName' | 'email' | 'employeeCode' | 'defaultUnit', string>>;

/** Fields a backend message can be about, in the order they are looked for (texts: users.serverField.*). */
const SERVER_FIELDS: (keyof FieldErrors)[] = ['username', 'password', 'email', 'employeeCode', 'fullName', 'defaultUnit'];

/** Puts a backend message on the field it is about, so it shows next to that input. */
const fieldOfServerError = (message: string): keyof FieldErrors | null => {
  const m = message.toLowerCase();
  return SERVER_FIELDS.find(field => m.includes(translate(`users.serverField.${field}`).toLowerCase())) ?? null;
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
  const { t } = useLanguage();
  const selected = new Set([defaultUnit, ...allowed]);
  const allSelected = units.every(u => selected.has(u.code));
  return (
    <div className="space-y-2">
      <SelectInput label={t('users.form.defaultUnit')} required value={defaultUnit} error={error}
        hint={t('users.form.defaultUnitHint')}
        onChange={(e) => onDefaultUnitChange(e.target.value)}
        options={units.map(u => ({ value: u.code, label: `${u.code} - ${u.name}` }))} />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('users.form.allowedUnits')}</span>
          <button type="button" className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            onClick={() => onAllowedChange(allSelected ? [] : units.map(u => u.code))}>
            {allSelected ? t('users.form.onlyDefaultUnit') : t('users.form.selectAll')}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 rounded-[5px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          {units.map(u => (
            <Checkbox
              key={u.code}
              checked={selected.has(u.code)}
              disabled={u.code === defaultUnit}
              label={`${u.code} - ${u.shortName || u.name}`}
              subLabel={u.code === defaultUnit ? t('users.form.isDefaultUnit') : undefined}
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
  const { t } = useLanguage();
  const role = roles.find(r => r.id === value);
  const viewable = role ? countViewable(toFullMatrix({ isSystemAdmin: role.isSystemRole, permissions: role.permissions })) : 0;
  return (
    <div className="space-y-1.5">
      <SelectInput label={t('users.form.role')} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={t('users.form.noRoleNoRights')}
        options={roles.map(r => ({ value: r.id, label: `${r.name} [${r.code}]` }))} />
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {role
          ? <>{role.isSystemRole ? t('users.form.roleAll') : t('users.form.roleViewable', { n: viewable })} {role.description}</>
          : t('users.form.roleNone')}
      </p>
    </div>
  );
};

export const CreateUserModal: React.FC<{
  roles: RoleDefinition[];
  units: CompanyUnit[];
  departments: DepartmentOption[];
  defaultUnitCode: string;
  suggestedEmployeeCode: string;
  onClose: () => void;
  onCreated: (user: UserProfile) => void;
}> = ({ roles, units, departments, defaultUnitCode, suggestedEmployeeCode, onClose, onCreated }) => {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    username: '', password: '', confirmPassword: '', fullName: '', employeeCode: suggestedEmployeeCode,
    email: '', phone: '', departmentCode: '', roleId: roles.find(r => !r.isSystemRole)?.id || '',
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
      e.username = t('users.form.usernameInvalid');
    if (form.password.length < MIN_PASSWORD) e.password = t('users.form.minPassword', { n: MIN_PASSWORD });
    if (form.confirmPassword !== form.password) e.confirmPassword = t('users.form.passwordMismatch');
    if (!form.fullName.trim()) e.fullName = t('users.form.fullNameRequired');
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) e.email = t('users.form.emailInvalid');
    if (!form.defaultUnit) e.defaultUnit = t('users.form.unitRequired');
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
        departmentCode: form.departmentCode || null,
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
    showToast.info(t('users.form.passwordGenerated'));
  };

  return (
    <Modal isOpen onClose={onClose} maxWidth="3xl" title={<><UserPlus className="h-5 w-5 text-indigo-600" /> {t('users.form.createTitle')}</>}>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <FormSection icon={<KeyRound />} title={t('users.form.loginSection')}
          description={t('users.form.loginSectionHint')}
          action={<Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={fillGeneratedPassword}
            icon={<Sparkles className="h-3.5 w-3.5 text-indigo-500" />}>{t('users.form.generatePassword')}</Button>}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TextInput label={t('users.form.username')} required autoFocus autoComplete="off" placeholder={t('users.form.usernamePlaceholder')}
              value={form.username} error={errors.username} hint={t('users.form.usernameHint')}
              onChange={(e) => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))} />
            <PasswordInput label={t('users.form.initialPassword')} required autoComplete="new-password"
              value={form.password} error={errors.password} hint={t('users.form.minPassword', { n: MIN_PASSWORD })}
              onChange={(e) => set('password', e.target.value)} />
            <PasswordInput label={t('users.form.confirmPassword')} required autoComplete="new-password"
              value={form.confirmPassword} error={errors.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)} />
          </div>
        </FormSection>

        <FormSection icon={<UserRound />} title={t('users.form.employeeSection')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TextInput label={t('users.form.fullName')} required wrapperClassName="md:col-span-2" value={form.fullName} error={errors.fullName}
              onChange={(e) => set('fullName', e.target.value)} />
            <TextInput label={t('users.form.employeeCode')} className="font-mono" value={form.employeeCode} error={errors.employeeCode}
              onChange={(e) => set('employeeCode', e.target.value.toUpperCase())} />
            <TextInput label={t('users.form.email')} type="email" value={form.email} error={errors.email}
              onChange={(e) => set('email', e.target.value)} />
            <TextInput label={t('users.form.phone')} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            <DepartmentSelect departments={departments} value={form.departmentCode} onChange={(code) => set('departmentCode', code)} />
          </div>
        </FormSection>

        <FormSection icon={<ShieldCheck />} title={t('users.form.accessSection')}
          description={t('users.form.accessSectionHint')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RolePicker roles={roles} value={form.roleId} onChange={(id) => set('roleId', id)} />
            <UnitAccessFields units={units} defaultUnit={form.defaultUnit} allowed={form.allowedUnits} error={errors.defaultUnit}
              onDefaultUnitChange={(code) => set('defaultUnit', code)} onAllowedChange={(codes) => set('allowedUnits', codes)} />
          </div>
        </FormSection>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>{t('users.form.cancel')}</Button>
          <Button type="submit" size="sm" disabled={saving} icon={<Save className="h-3.5 w-3.5" />}>
            {saving ? t('users.form.creating') : t('users.form.createUser')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export const EditUserModal: React.FC<{
  user: UserProfile;
  units: CompanyUnit[];
  departments: DepartmentOption[];
  isSelf: boolean;
  onClose: () => void;
  onSaved: (user: UserProfile) => void;
}> = ({ user, units, departments, isSelf, onClose, onSaved }) => {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    fullName: user.fullName, employeeCode: user.employeeCode || '', email: user.email, phone: user.phone,
    departmentCode: user.departmentCode ?? '', isActive: user.isActive !== false,
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
    if (!form.fullName.trim()) found.fullName = t('users.form.fullNameRequired');
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) found.email = t('users.form.emailInvalid');
    setErrors(found);
    if (Object.keys(found).length > 0 || lockingSelf) return;
    setSaving(true);
    try {
      onSaved(await usersApi.update(user.id, {
        fullName: form.fullName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        departmentCode: form.departmentCode || null,
        avatar: user.avatar,
        themePref: user.themePref,
        notificationsEnabled: user.notificationsEnabled,
        employeeCode: form.employeeCode.trim() || undefined,
        isActive: form.isActive,
        ma_dvcs: form.defaultUnit,
        ds_ma_dvcs: form.allowedUnits,
        version: user.version
      }));
    } catch (error) {
      onServerError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < MIN_PASSWORD) {
      setErrors(prev => ({ ...prev, password: t('users.form.minPassword', { n: MIN_PASSWORD }) }));
      return;
    }
    setSaving(true);
    try {
      await usersApi.resetPassword(user.id, newPassword);
      setNewPassword('');
      showToast.success(t('users.form.passwordReset', { username: user.username }));
    } catch (error) {
      onServerError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} maxWidth="3xl" title={<><UserRound className="h-5 w-5 text-indigo-600" /> {t('users.form.editTitle', { username: user.username })}</>}>
      <div className="space-y-3">
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <FormSection icon={<UserRound />} title={t('users.form.employeeSection')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <TextInput label={t('users.form.fullName')} required wrapperClassName="md:col-span-2" value={form.fullName} error={errors.fullName}
                onChange={(e) => set('fullName', e.target.value)} />
              <TextInput label={t('users.form.employeeCode')} className="font-mono" value={form.employeeCode} error={errors.employeeCode}
                onChange={(e) => set('employeeCode', e.target.value.toUpperCase())} />
              <TextInput label={t('users.form.email')} type="email" value={form.email} error={errors.email} onChange={(e) => set('email', e.target.value)} />
              <TextInput label={t('users.form.phone')} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              <DepartmentSelect departments={departments} value={form.departmentCode} onChange={(code) => set('departmentCode', code)} />
            </div>
          </FormSection>

          <FormSection icon={<Building2 />} title={t('users.form.unitStatusSection')}>
            <UnitAccessFields units={units} defaultUnit={form.defaultUnit} allowed={form.allowedUnits} error={errors.defaultUnit}
              onDefaultUnitChange={(code) => set('defaultUnit', code)} onAllowedChange={(codes) => set('allowedUnits', codes)} />
            <Checkbox
              checked={form.isActive}
              disabled={isSelf}
              onChange={(on) => set('isActive', on)}
              label={t('users.form.isActive')}
              subLabel={isSelf ? t('users.form.cannotLockSelf') : t('users.form.isActiveHint')}
            />
          </FormSection>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>{t('users.form.close')}</Button>
            <Button type="submit" size="sm" disabled={saving} icon={<Save className="h-3.5 w-3.5" />}>{t('users.form.saveAccount')}</Button>
          </div>
        </form>

        {isSelf ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> {t('users.form.selfPasswordHint')}
          </p>
        ) : (
        <FormSection icon={<KeyRound />} title={t('users.form.resetSection')}
          description={t('users.form.resetSectionHint')}>
          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
            <PasswordInput wrapperClassName="grow" autoComplete="new-password" placeholder={t('users.form.newPasswordPlaceholder', { n: MIN_PASSWORD })}
              value={newPassword} error={errors.password}
              onChange={(e) => { setNewPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })); }} />
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setNewPassword(generatePassword())}
              icon={<Sparkles className="h-3.5 w-3.5 text-indigo-500" />}>{t('users.form.generate')}</Button>
            <Button type="button" variant="outline" size="sm" className="h-8" disabled={saving} onClick={() => void handleResetPassword()}
              icon={<KeyRound className="h-3.5 w-3.5" />}>{t('users.form.reset')}</Button>
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
  const { t } = useLanguage();
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
    <Modal isOpen onClose={onClose} maxWidth="lg" title={<><ShieldCheck className="h-5 w-5 text-indigo-600" /> {t('roles.form.createTitle')}</>}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TextInput label={t('roles.form.code')} required autoFocus className="font-mono uppercase" value={code} placeholder={t('roles.form.codePlaceholder')}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, '_'))} />
          <TextInput label={t('roles.form.name')} required wrapperClassName="sm:col-span-2" value={name} placeholder={t('roles.form.namePlaceholder')}
            onChange={(e) => setName(e.target.value)} />
        </div>
        <SelectInput label={t('roles.form.copyFrom')} value={baseRoleId} onChange={(e) => setBaseRoleId(e.target.value)}
          placeholder={t('roles.form.noCopy')} hint={t('roles.form.copyHint')}
          options={templates.map(r => ({ value: r.id, label: `${r.name} [${r.code}]` }))} />
        <TextArea label={t('roles.form.description')} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>{t('users.form.cancel')}</Button>
          <Button type="submit" size="sm" disabled={saving} icon={<Save className="h-3.5 w-3.5" />}>{t('roles.form.create')}</Button>
        </div>
      </form>
    </Modal>
  );
};
