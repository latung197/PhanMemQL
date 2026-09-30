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
  countDifferences, countRightDifferences, FullMatrix, matrixEquals, normalizeRights, toFullMatrix, uniformMatrix
} from './permissionCatalog';
import { initials } from './UserListPanel';

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
  const saved = useMemo<UserAccessDraft>(() => ({
    roleId: user.roleId ?? '', matrix: toFullMatrix(user), rights: normalizeRights(user.specialRights)
  }), [user]);
  const { draft, setDraft, dirty, reset } = useDraft(saved, (a, b) =>
    a.roleId === b.roleId && matrixEquals(a.matrix, b.matrix) && countRightDifferences(a.rights, b.rights) === 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const role = roles.find(r => r.id === draft.roleId);
  const baseline = roleMatrix(role);
  const baselineRights = role ? normalizeRights(role.specialRights) : undefined;
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
    // Like "gán nhanh theo vai trò": the role's rights become the starting point of the user's matrix.
    setDraft({ roleId, matrix: roleMatrix(next) ?? draft.matrix, rights: next ? normalizeRights(next.specialRights) : draft.rights });
    if (next) showToast.info(`Đã nạp quyền của vai trò "${next.name}". Bạn có thể chỉnh thêm trước khi lưu.`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const matrix = isAdmin ? uniformMatrix('all') : draft.matrix;
      const result = await usersApi.setPermissions(user.id, draft.roleId || null, matrix, isAdmin ? [] : draft.rights);
      reset({ roleId: result.roleId ?? '', matrix: toFullMatrix(result), rights: normalizeRights(result.specialRights) });
      onSaved(result);
      showToast.success(`Đã lưu phân quyền cho @${user.username}`);
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
              {user.isSystemAdmin && <Badge variant="warning" size="sm">Quản trị viên</Badge>}
              {user.isActive === false
                ? <Badge variant="danger" size="sm">Đã khóa</Badge>
                : <Badge variant="success" size="sm">Hoạt động</Badge>}
              {isSelf && <Badge variant="indigo" size="sm">Bạn</Badge>}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              @{user.username}
              {user.employeeCode && <> · Mã NV <span className="font-mono">{user.employeeCode}</span></>}
              {user.department && <> · {user.department}</>}
              {user.email && <> · {user.email}</>}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-wrap">
              <Building2 className="h-3 w-3" />
              Mặc định <strong className="text-slate-700 dark:text-slate-300">{unitName(user.ma_dvcs)}</strong>
              · Được vào: {(user.ds_ma_dvcs ?? []).map(unitName).join(', ') || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canEdit && (
            <Button variant="outline" size="sm" className="h-7" onClick={onEditAccount} icon={<UserCog className="h-3.5 w-3.5" />}>
              Sửa tài khoản
            </Button>
          )}
          {canDelete && !isSelf && (
            <Button variant="outline" size="sm" className="h-7 text-rose-600 dark:text-rose-400" onClick={onDelete}
              icon={<Trash2 className="h-3.5 w-3.5" />}>
              Xóa
            </Button>
          )}
        </div>
      </div>

      {/* Role */}
      <div className="flex flex-col md:flex-row md:items-end gap-2 p-2.5 rounded-[5px] bg-brand-50 dark:bg-slate-800/60 border border-brand-200 dark:border-slate-700">
        <SelectInput
          label="Vai trò"
          wrapperClassName="md:w-80"
          value={draft.roleId}
          disabled={!canEdit || selfLocked || (isSelf && user.isSystemAdmin)}
          onChange={(e) => handleRoleChange(e.target.value)}
          placeholder="— Chưa gán vai trò —"
          options={roles.map(r => ({ value: r.id, label: `${r.name} [${r.code}]` }))}
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 grow">
          {isAdmin
            ? 'Vai trò quản trị có toàn quyền trên mọi chức năng.'
            : 'Tài khoản dùng quyền của vai trò. Ô nào bật/tắt khác vai trò được lưu thành quyền riêng (tô màu); các ô còn lại tự theo mỗi khi vai trò thay đổi.'}
        </p>
        {!readOnly && baseline && (countDifferences(baseline, draft.matrix) + countRightDifferences(baselineRights ?? [], draft.rights)) > 0 && (
          <Button variant="outline" size="sm" className="h-7 shrink-0" icon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={() => setDraft({ ...draft, matrix: baseline, rights: baselineRights ?? [] })}>
            Đưa về đúng quyền vai trò
          </Button>
        )}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 p-2.5 rounded-[5px] border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Tài khoản quản trị luôn có toàn quyền; ma trận bên dưới chỉ để xem.
        </div>
      )}
      {canEdit && selfLocked && (
        <div className="flex items-center gap-2 text-[11px] text-slate-500"><Lock className="h-3.5 w-3.5" /> Bạn không thể tự thay đổi quyền của chính mình. Hãy nhờ quản trị viên.</div>
      )}
      {!canEdit && (
        <div className="flex items-center gap-2 text-[11px] text-slate-500"><Lock className="h-3.5 w-3.5" /> Bạn chỉ có quyền xem phân quyền.</div>
      )}

      <PermissionMatrixTable
        value={isAdmin ? uniformMatrix('all') : draft.matrix}
        onChange={(matrix) => setDraft(prev => ({ ...prev, matrix }))}
        rights={isAdmin ? allRights : draft.rights}
        onRightsChange={(rights) => setDraft(prev => ({ ...prev, rights: normalizeRights(rights) }))}
        rightDefs={rightDefs}
        rightGroupLabels={rightGroupLabels}
        readOnly={readOnly}
        baseline={isAdmin ? undefined : baseline}
        baselineRights={isAdmin ? undefined : baselineRights}
      />

      <SaveBar changes={dirty ? Math.max(changes, 1) : 0} saving={saving} onSave={handleSave} onDiscard={() => reset()}
        saveLabel="Lưu phân quyền" />
    </div>
  );
};
