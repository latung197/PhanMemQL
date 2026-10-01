import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { RoleDefinition } from '../../../types';
import { SpecialRightDef } from '../../../services/settingsApi';
import { Button } from '../../../components/common/Button';
import { TextArea, TextInput } from '../../../components/common/FormField';
import { useConfirm } from '../../../components/common/ConfirmDialog';
import { rolesApi } from '../../../services/settingsApi';
import { getErrorMessage } from '../../../services/apiClient';
import { showToast } from '../../../utils/toast';
import { useDraft } from '../../../hooks/useDraft';
import { PermissionMatrixTable } from './PermissionMatrixTable';
import { SaveBar } from './SaveBar';
import { useLanguage } from '../../../context/LanguageContext';
import {
  countDifferences, countRightDifferences, countViewable, FullMatrix, matrixEquals, normalizeRights, toFullMatrix, uniformMatrix
} from './permissionCatalog';

interface RoleDetailPanelProps {
  role: RoleDefinition;
  userCount: number;
  rightDefs: SpecialRightDef[];
  rightGroupLabels: Record<string, string>;
  canEdit: boolean;
  canDelete: boolean;
  onSaved: (role: RoleDefinition) => void;
  onDeleted: (role: RoleDefinition) => void;
  onSynced: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

interface RoleDraft {
  code: string;
  name: string;
  description: string;
  matrix: FullMatrix;
  rights: string[];
}

/** Role name, description and its standard permission matrix. */
export const RoleDetailPanel: React.FC<RoleDetailPanelProps> = ({
  role, userCount, rightDefs, rightGroupLabels, canEdit, canDelete, onSaved, onDeleted, onSynced, onDirtyChange
}) => {
  const confirm = useConfirm();
  const { t } = useLanguage();
  const saved = useMemo<RoleDraft>(() => ({
    code: role.code, name: role.name, description: role.description,
    matrix: toFullMatrix({ isSystemAdmin: role.isSystemRole, permissions: role.permissions }),
    rights: normalizeRights(role.specialRights)
  }), [role]);
  const { draft, setDraft, dirty, reset } = useDraft(saved, (a, b) =>
    a.code === b.code && a.name === b.name && a.description === b.description && matrixEquals(a.matrix, b.matrix)
    && countRightDifferences(a.rights, b.rights) === 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const readOnly = !canEdit || role.isSystemRole;
  const changes = countDifferences(saved.matrix, draft.matrix) + countRightDifferences(saved.rights, draft.rights)
    + ['code', 'name', 'description'].filter(k => draft[k as keyof RoleDraft] !== saved[k as keyof RoleDraft]).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await rolesApi.update(role.id, {
        code: draft.code.trim(), name: draft.name.trim(), description: draft.description.trim(), permissions: draft.matrix,
        specialRights: draft.rights
      });
      onSaved(result);
      showToast.success(t('roles.detail.saved', { name: result.name }),
        userCount > 0 ? t('roles.detail.savedHint', { n: userCount }) : undefined);
    } catch (error) {
      showToast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    const ok = await confirm({
      title: t('roles.detail.syncTitle', { n: userCount, name: role.name }),
      message: t('roles.detail.syncMessage'),
      confirmLabel: t('roles.detail.syncConfirm'),
      tone: 'warning'
    });
    if (!ok) return;
    try {
      const count = await rolesApi.syncUsers(role.id);
      showToast.success(t('roles.detail.synced', { n: count }));
      onSynced();
    } catch (error) {
      showToast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('roles.detail.deleteTitle', { name: role.name }),
      message: t('roles.detail.deleteMessage'),
      confirmLabel: t('roles.detail.deleteConfirm'),
      tone: 'danger'
    });
    if (!ok) return;
    try {
      await rolesApi.remove(role.id);
      showToast.success(t('roles.detail.deleted', { name: role.name }));
      onDeleted(role);
    } catch (error) {
      showToast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 min-h-full">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{role.name}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t('roles.detail.summary', { users: userCount, n: countViewable(draft.matrix) })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canEdit && !role.isSystemRole && (
            <Button variant="outline" size="sm" className="h-7" disabled={dirty || userCount === 0}
              title={dirty ? t('roles.detail.saveFirst') : t('roles.detail.syncHint')}
              onClick={() => void handleSync()} icon={<RefreshCcw className="h-3.5 w-3.5" />}>
              {t('roles.detail.sync', { n: userCount })}
            </Button>
          )}
          {canDelete && !role.isSystemRole && (
            <Button variant="outline" size="sm" className="h-7 text-rose-600 dark:text-rose-400" disabled={userCount > 0}
              title={userCount > 0 ? t('roles.detail.inUse', { n: userCount }) : undefined}
              onClick={() => void handleDelete()} icon={<Trash2 className="h-3.5 w-3.5" />}>
              {t('roles.detail.delete')}
            </Button>
          )}
        </div>
      </div>

      <fieldset disabled={readOnly} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TextInput label={t('roles.form.code')} required className="font-mono uppercase" value={draft.code}
          onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
        <TextInput label={t('roles.form.name')} required wrapperClassName="md:col-span-2" value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <TextArea label={t('roles.form.description')} rows={2} wrapperClassName="md:col-span-3" value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      </fieldset>

      {role.isSystemRole && (
        <div className="flex items-center gap-2 p-2.5 rounded-[5px] border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {t('roles.detail.systemRole')}
        </div>
      )}

      <PermissionMatrixTable
        value={role.isSystemRole ? uniformMatrix('all') : draft.matrix}
        onChange={(matrix) => setDraft(prev => ({ ...prev, matrix }))}
        rights={role.isSystemRole ? rightDefs.map(d => d.key) : draft.rights}
        onRightsChange={(rights) => setDraft(prev => ({ ...prev, rights: normalizeRights(rights) }))}
        rightDefs={rightDefs}
        rightGroupLabels={rightGroupLabels}
        readOnly={readOnly}
      />

      <SaveBar changes={dirty ? Math.max(changes, 1) : 0} saving={saving} onSave={() => void handleSave()}
        onDiscard={() => reset()} saveLabel={t('roles.detail.save')} />
    </div>
  );
};
