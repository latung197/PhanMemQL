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
      showToast.success(`Đã lưu vai trò "${result.name}"`);
      if (userCount > 0) showToast.info(`Bấm "Áp dụng cho ${userCount} người dùng" để cập nhật quyền của những người đang giữ vai trò này.`);
    } catch (error) {
      showToast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    const ok = await confirm({
      title: `Áp dụng quyền vai trò "${role.name}"?`,
      message: `Ma trận quyền riêng của ${userCount} người dùng đang giữ vai trò này sẽ được thay bằng quyền của vai trò. Các chỉnh sửa riêng trước đó sẽ mất.`,
      confirmLabel: 'Áp dụng',
      tone: 'warning'
    });
    if (!ok) return;
    try {
      const count = await rolesApi.syncUsers(role.id);
      showToast.success(`Đã áp dụng quyền vai trò cho ${count} người dùng`);
      onSynced();
    } catch (error) {
      showToast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Xóa vai trò "${role.name}"?`,
      message: 'Vai trò và bộ quyền của nó sẽ bị xóa hẳn, không khôi phục được. Quyền riêng của các tài khoản không bị ảnh hưởng.',
      confirmLabel: 'Xóa vai trò',
      tone: 'danger'
    });
    if (!ok) return;
    try {
      await rolesApi.remove(role.id);
      showToast.success(`Đã xóa vai trò "${role.name}"`);
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
            {userCount} người dùng · được xem {countViewable(draft.matrix)} chức năng
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canEdit && !role.isSystemRole && (
            <Button variant="outline" size="sm" className="h-7" disabled={dirty || userCount === 0}
              title={dirty ? 'Lưu vai trò trước khi áp dụng' : undefined}
              onClick={() => void handleSync()} icon={<RefreshCcw className="h-3.5 w-3.5" />}>
              Áp dụng cho {userCount} người dùng
            </Button>
          )}
          {canDelete && !role.isSystemRole && (
            <Button variant="outline" size="sm" className="h-7 text-rose-600 dark:text-rose-400" disabled={userCount > 0}
              title={userCount > 0 ? `Đang có ${userCount} người dùng giữ vai trò này; hãy chuyển họ sang vai trò khác trước` : undefined}
              onClick={() => void handleDelete()} icon={<Trash2 className="h-3.5 w-3.5" />}>
              Xóa
            </Button>
          )}
        </div>
      </div>

      <fieldset disabled={readOnly} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TextInput label="Mã vai trò" required className="font-mono uppercase" value={draft.code}
          onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
        <TextInput label="Tên vai trò" required wrapperClassName="md:col-span-2" value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <TextArea label="Mô tả nhiệm vụ" rows={2} wrapperClassName="md:col-span-3" value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      </fieldset>

      {role.isSystemRole && (
        <div className="flex items-center gap-2 p-2.5 rounded-[5px] border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Vai trò quản trị hệ thống luôn có toàn quyền và không chỉnh sửa được.
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
        onDiscard={() => reset()} saveLabel="Lưu vai trò" />
    </div>
  );
};
