import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Lock, RotateCcw, ShieldAlert, Trash2, UserCog } from 'lucide-react';
import { CompanyUnit, RoleDefinition, UserProfile } from '../../../types';
import { SpecialRightDef } from '../../../services/settingsApi';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { SelectInput } from '../../../components/common/FormField';
import { usersApi } from '../../../services/settingsApi';
import { getErrorMessage } from '../../../services/apiClient';
import { showToast } from '../../../utils/toast';
import { useDraft } from '../../../hooks/useDraft';
import { PermissionMatrixTable } from './PermissionMatrixTable';
import { SaveBar } from './SaveBar';
import {
  countDifferences, countRightDifferences, FullMatrix, FUNCTIONS, matrixEquals, normalizeRights, toFullMatrix, uniformMatrix,
  visibleRights
} from './permissionCatalog';
import { initials } from './UserListPanel';
import { useLanguage } from '../../../context/LanguageContext';

interface UserDetailPanelProps {
  user: UserProfile;
  roles: RoleDefinition[];
  companyUnits: CompanyUnit[];
  rightDefs: SpecialRightDef[];
  rightGroupLabels: Record<string, string>;
  isSelf: boolean;
  /** The signed-in user is an administrator (only administrators may change their own rights). */
  actorIsAdmin: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onSaved: (user: UserProfile) => void;
  onEditAccount: () => void;
  onDelete: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

interface UserAccessDraft {
  roleId: string;
  matrix: FullMatrix;
  rights: string[];
}

const roleMatrix = (role?: RoleDefinition) =>
  role ? toFullMatrix({ isSystemAdmin: role.isSystemRole, permissions: role.permissions }) : undefined;

/** Account summary, role assignment and the user's own permission matrix. */
export const UserDetailPanel: React.FC<UserDetailPanelProps> = ({
  user, roles, companyUnits, rightDefs, rightGroupLabels, isSelf, actorIsAdmin, canEdit, canDelete, onSaved, onEditAccount, onDelete, onDirtyChange
}) => {
  const { t } = useLanguage();
  const saved = useMemo<UserAccessDraft>(() => ({
    roleId: user.roleId ?? '', matrix: toFullMatrix(user), rights: normalizeRights(user.specialRights)
  }), [user]);
  const { draft, setDraft, dirty, reset } = useDraft(saved, (a, b) =>
    a.roleId === b.roleId && matrixEquals(a.matrix, b.matrix) && countRightDifferences(a.rights, b.rights) === 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const role = roles.find(r => r.id === draft.roleId);
  const baseline = roleMatrix(role);
  // What the role gives this user: its special rights on the functions the user may view (as the backend counts them).
  const baselineRights = role ? visibleRights(role.specialRights, draft.matrix) : undefined;
  const allRights = useMemo(() => rightDefs.map(d => d.key), [rightDefs]);
  const isAdmin = role?.isSystemRole ?? (user.isSystemAdmin && draft.roleId === saved.roleId);
  // Same rule as the backend: nobody but an administrator changes their own permissions.
  const selfLocked = isSelf && !actorIsAdmin;
  const readOnly = !canEdit || isAdmin || selfLocked;
  const changes = countDifferences(saved.matrix, draft.matrix) + countRightDifferences(saved.rights, draft.rights)
    + (draft.roleId !== saved.roleId ? 1 : 0);
  const unitName = (code?: string) => companyUnits.find(u => u.code === code)?.shortName || code || '—';

  const handleRoleChange = (roleId: string) => {
    const next = roles.find(r => r.id === roleId);
    // Like a quick assignment by role: the role's rights become the starting point of the user's matrix.
    const matrix = roleMatrix(next) ?? draft.matrix;
    setDraft({ roleId, matrix, rights: next ? visibleRights(next.specialRights, matrix) : draft.rights });
    if (next) showToast.info(t('users.detail.roleLoaded', { name: next.name }));
  };

  /** A function the user may now view brings back the role's special rights on it (they follow the role). */
  const handleMatrixChange = (matrix: FullMatrix) => setDraft(prev => {
    const opened = FUNCTIONS.filter(fn => !prev.matrix[fn.subKey]?.view && matrix[fn.subKey]?.view).map(fn => `${fn.subKey}:`);
    const fromRole = (role?.specialRights ?? []).filter(key => opened.some(prefix => key.startsWith(prefix)));
    return { ...prev, matrix, rights: normalizeRights([...prev.rights, ...fromRole]) };
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const matrix = isAdmin ? uniformMatrix('all') : draft.matrix;
      const result = await usersApi.setPermissions(user.id, draft.roleId || null, matrix, isAdmin ? [] : draft.rights,
        user.version);
      reset({ roleId: result.roleId ?? '', matrix: toFullMatrix(result), rights: normalizeRights(result.specialRights) });
      onSaved(result);
      showToast.success(t('users.detail.saved', { username: user.username }));
    } catch (error) {
      showToast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 min-h-full">
      {/* Account header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="h-11 w-11 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold shrink-0">
            {initials(user.fullName)}
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{user.fullName}</h3>
              {user.isSystemAdmin && <Badge variant="warning" size="sm">{t('users.admin')}</Badge>}
              {user.isActive === false
                ? <Badge variant="danger" size="sm">{t('users.locked')}</Badge>
                : <Badge variant="success" size="sm">{t('users.active')}</Badge>}
              {isSelf && <Badge variant="indigo" size="sm">{t('users.you')}</Badge>}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              @{user.username}
              {user.employeeCode && <> · {t('users.detail.employeeCode')} <span className="font-mono">{user.employeeCode}</span></>}
              {user.department && <> · {user.department}</>}
              {user.email && <> · {user.email}</>}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-wrap">
              <Building2 className="h-3 w-3" />
              {t('users.detail.defaultUnit')} <strong className="text-slate-700 dark:text-slate-300">{unitName(user.ma_dvcs)}</strong>
              · {t('users.detail.allowedUnits')} {(user.ds_ma_dvcs ?? []).map(unitName).join(', ') || '—'}
            </p>
            {isAdmin && (
              <p className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[5px] border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-[11px]">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                {t('users.detail.adminNotice')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canEdit && (
            <Button variant="outline" size="sm" className="h-7" onClick={onEditAccount} icon={<UserCog className="h-3.5 w-3.5" />}>
              {t('users.detail.editAccount')}
            </Button>
          )}
          {canDelete && !isSelf && (
            <Button variant="outline" size="sm" className="h-7 text-rose-600 dark:text-rose-400" onClick={onDelete}
              icon={<Trash2 className="h-3.5 w-3.5" />}>
              {t('users.detail.delete')}
            </Button>
          )}
        </div>
      </div>

      {/* Role */}
      {/* One row while there is room (label + picker always together); the hint wraps below when the panel is narrow. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-1.5 rounded-[5px] bg-brand-50 dark:bg-slate-800/60 border border-brand-200 dark:border-slate-700">
        <label htmlFor={`user-role-${user.id}`} className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
          {t('users.detail.role')}
        </label>
        <SelectInput
          id={`user-role-${user.id}`}
          wrapperClassName="w-72 max-w-[calc(100%-3.5rem)] shrink-0"
          value={draft.roleId}
          disabled={!canEdit || selfLocked || (isSelf && user.isSystemAdmin)}
          onChange={(e) => handleRoleChange(e.target.value)}
          placeholder={t('users.detail.noRole')}
          options={roles.map(r => ({ value: r.id, label: `${r.name} [${r.code}]` }))}
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex-1 min-w-[220px]">
          {isAdmin
            ? t('users.detail.adminRoleHint')
            : t('users.detail.roleHint')}
        </p>
        {!readOnly && baseline && (countDifferences(baseline, draft.matrix) + countRightDifferences(baselineRights ?? [], draft.rights)) > 0 && (
          <Button variant="outline" size="sm" className="h-7 shrink-0" icon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={() => setDraft({ ...draft, matrix: baseline, rights: visibleRights(role?.specialRights, baseline) })}>
            {t('users.detail.resetToRole')}
          </Button>
        )}
      </div>

      {canEdit && selfLocked && (
        <div className="flex items-center gap-2 text-[11px] text-slate-500"><Lock className="h-3.5 w-3.5" /> {t('users.detail.selfLocked')}</div>
      )}
      {!canEdit && (
        <div className="flex items-center gap-2 text-[11px] text-slate-500"><Lock className="h-3.5 w-3.5" /> {t('users.detail.viewOnly')}</div>
      )}

      <PermissionMatrixTable
        value={isAdmin ? uniformMatrix('all') : draft.matrix}
        onChange={handleMatrixChange}
        rights={isAdmin ? allRights : draft.rights}
        onRightsChange={(rights) => setDraft(prev => ({ ...prev, rights: normalizeRights(rights) }))}
        rightDefs={rightDefs}
        rightGroupLabels={rightGroupLabels}
        readOnly={readOnly}
        baseline={isAdmin ? undefined : baseline}
        baselineRights={isAdmin ? undefined : baselineRights}
      />

      <SaveBar changes={dirty ? Math.max(changes, 1) : 0} saving={saving} onSave={handleSave} onDiscard={() => reset()}
        saveLabel={t('users.detail.savePermissions')} />
    </div>
  );
};
