// Settings › Người dùng & Phân quyền: accounts and roles with their permission matrices.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, GitBranch, Plus, RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Tabs } from '../../components/common/Tabs';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StateViews';
import { showToast } from '../../utils/toast';
import { getErrorMessage } from '../../services/apiClient';
import { PermissionCatalog, permissionCatalogApi, rolesApi, usersApi } from '../../services/settingsApi';
import { CompanyUnit, RoleDefinition, UserProfile } from '../../types';
import { getActionPermission } from '../../utils/permissions';
import { CreateRoleModal, CreateUserModal, EditUserModal } from './UserAccountModals';
import { UserListPanel } from './permissions/UserListPanel';
import { UserDetailPanel } from './permissions/UserDetailPanel';
import { RoleListPanel } from './permissions/RoleListPanel';
import { RoleDetailPanel } from './permissions/RoleDetailPanel';
import { ApprovalRulesPanel } from './permissions/ApprovalRulesPanel';

interface UserPermissionManagerProps {
  currentUser: UserProfile;
  companyUnits: CompanyUnit[];
}

type View = 'users' | 'roles' | 'approvals';

const panelClass = 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-lg shadow-2xs min-h-0 overflow-hidden';

export const UserPermissionManager: React.FC<UserPermissionManagerProps> = ({ currentUser, companyUnits }) => {
  const confirm = useConfirm();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalog>({ specialRights: [], groups: { data: '', scope: '', status: '', feature: '' } });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>('users');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [modal, setModal] = useState<'createUser' | 'createRole' | 'editUser' | null>(null);

  const perms = getActionPermission(currentUser, 'sys_users');
  const activeUnits = companyUnits.filter(u => u.status === 'Hoạt động');

  const loadData = useCallback(async () => {
    try {
      const [userList, roleList, rightCatalog] = await Promise.all([usersApi.getAll(), rolesApi.getAll(), permissionCatalogApi.get()]);
      setUsers(userList);
      setRoles(roleList);
      setCatalog(rightCatalog);
      setLoadError('');
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const selectedUser = users.find(u => u.id === selectedUserId) ?? users[0];
  const selectedRole = roles.find(r => r.id === selectedRoleId) ?? roles[0];
  const userCounts = useMemo(() => users.reduce<Record<string, number>>((acc, u) => {
    if (u.roleId) acc[u.roleId] = (acc[u.roleId] ?? 0) + 1;
    return acc;
  }, {}), [users]);

  /** Asks before leaving a record with unsaved edits. */
  const leave = async (action: () => void) => {
    if (isDirty && !(await confirm({
      title: 'Bỏ các thay đổi chưa lưu?',
      message: 'Các quyền vừa chỉnh sửa chưa được lưu và sẽ bị bỏ.',
      confirmLabel: 'Bỏ thay đổi',
      tone: 'warning'
    }))) return;
    setIsDirty(false);
    action();
  };

  const replaceUser = (user: UserProfile) => setUsers(prev => prev.map(u => u.id === user.id ? user : u));
  const handleDirtyChange = useCallback((dirty: boolean) => setIsDirty(dirty), []);

  const handleDeleteUser = async (user: UserProfile) => {
    const ok = await confirm({
      title: `Xóa tài khoản @${user.username}?`,
      message: 'Tài khoản sẽ không thể đăng nhập nữa. Lịch sử chứng từ của tài khoản vẫn được giữ lại.',
      confirmLabel: 'Xóa tài khoản',
      tone: 'danger'
    });
    if (!ok) return;
    try {
      await usersApi.remove(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setSelectedUserId('');
      showToast.success(`Đã xóa tài khoản @${user.username}`);
    } catch (error) {
      showToast.error(getErrorMessage(error));
    }
  };

  if (isLoading) return <div className={panelClass}><LoadingState label="Đang tải người dùng và vai trò..." /></div>;
  if (loadError) {
    return (
      <div className={panelClass}>
        <ErrorState message={loadError} onRetry={() => { setIsLoading(true); void loadData(); }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 min-h-0">
      {/* Toolbar */}
      <div className="px-3 py-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-200/80 dark:border-indigo-800/80 shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-slate-100">Người Dùng & Phân Quyền</h2>
              <span className="px-1.5 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 text-[10px] rounded-full font-bold">
                {users.length} người · {roles.length} vai trò
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Gán vai trò cho tài khoản rồi tinh chỉnh quyền Xem / Thêm-Sửa / Xóa / Duyệt / In-Xuất theo từng chức năng.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-[11px]" icon={<RefreshCw className="h-3.5 w-3.5 text-indigo-500" />}
            onClick={() => void leave(() => { setIsLoading(true); void loadData(); })}>
            Nạp lại
          </Button>
          {perms.createEdit && view !== 'approvals' && (view === 'users' ? (
            <Button size="sm" className="h-7 px-2.5 text-[11px]" icon={<UserPlus className="h-3.5 w-3.5" />}
              onClick={() => void leave(() => setModal('createUser'))}>
              Thêm người dùng
            </Button>
          ) : (
            <Button size="sm" className="h-7 px-2.5 text-[11px]" icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => void leave(() => setModal('createRole'))}>
              Thêm vai trò
            </Button>
          ))}
        </div>
      </div>

      <Tabs
        value={view}
        onChange={(next) => void leave(() => setView(next))}
        items={[
          { key: 'users', label: `Người dùng (${users.length})`, icon: <Users /> },
          { key: 'roles', label: `Vai trò (${roles.length})`, icon: <Briefcase /> },
          { key: 'approvals', label: 'Quy trình phê duyệt', icon: <GitBranch /> }
        ]}
      />

      {view === 'approvals' && (
        <div className={`${panelClass} lg:h-[calc(100vh-250px)]`}>
          <ApprovalRulesPanel users={users} roles={roles} companyUnits={activeUnits} rightDefs={catalog.specialRights}
            canEdit={perms.createEdit} />
        </div>
      )}

      {/* Master / detail */}
      {view !== 'approvals' && <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-2 min-h-0 lg:h-[calc(100vh-250px)]">
        <div className={`${panelClass} max-h-[50vh] lg:max-h-none`}>
          {view === 'users' ? (
            <UserListPanel users={users} roles={roles} selectedId={selectedUser?.id}
              onSelect={(u) => void leave(() => setSelectedUserId(u.id))} />
          ) : (
            <RoleListPanel roles={roles} userCounts={userCounts} selectedId={selectedRole?.id}
              onSelect={(r) => void leave(() => setSelectedRoleId(r.id))} />
          )}
        </div>

        <div className={`${panelClass} overflow-y-auto custom-scrollbar`}>
          {view === 'users' && (selectedUser ? (
            <UserDetailPanel
              key={selectedUser.id}
              user={selectedUser}
              roles={roles}
              companyUnits={companyUnits}
              rightDefs={catalog.specialRights}
              rightGroupLabels={catalog.groups}
              isSelf={selectedUser.id === currentUser.id}
              actorIsAdmin={!!currentUser.isSystemAdmin}
              canEdit={perms.createEdit}
              canDelete={perms.delete}
              onSaved={replaceUser}
              onEditAccount={() => setModal('editUser')}
              onDelete={() => void handleDeleteUser(selectedUser)}
              onDirtyChange={handleDirtyChange}
            />
          ) : <EmptyState title="Chưa có người dùng" />)}

          {view === 'roles' && (selectedRole ? (
            <RoleDetailPanel
              key={selectedRole.id}
              role={selectedRole}
              userCount={userCounts[selectedRole.id] ?? 0}
              rightDefs={catalog.specialRights}
              rightGroupLabels={catalog.groups}
              canEdit={perms.createEdit}
              canDelete={perms.delete}
              onSaved={(role) => setRoles(prev => prev.map(r => r.id === role.id ? role : r))}
              onDeleted={(role) => { setIsDirty(false); setRoles(prev => prev.filter(r => r.id !== role.id)); setSelectedRoleId(''); }}
              onSynced={() => void loadData()}
              onDirtyChange={handleDirtyChange}
            />
          ) : <EmptyState title="Chưa có vai trò" />)}
        </div>
      </div>}

      {modal === 'createUser' && (
        <CreateUserModal
          roles={roles}
          units={activeUnits}
          defaultUnitCode={currentUser.ma_dvcs || activeUnits[0]?.code || ''}
          suggestedEmployeeCode={`NV${String(users.length + 1).padStart(3, '0')}`}
          onClose={() => setModal(null)}
          onCreated={(user) => {
            setUsers(prev => [...prev, user].sort((a, b) => a.username.localeCompare(b.username)));
            setSelectedUserId(user.id);
            setModal(null);
            showToast.success(`Đã tạo tài khoản @${user.username}`);
          }}
        />
      )}

      {modal === 'createRole' && (
        <CreateRoleModal
          roles={roles}
          onClose={() => setModal(null)}
          onCreated={(role) => {
            setRoles(prev => [...prev, role]);
            setSelectedRoleId(role.id);
            setModal(null);
            showToast.success(`Đã tạo vai trò "${role.name}"`);
          }}
        />
      )}

      {modal === 'editUser' && selectedUser && (
        <EditUserModal
          user={selectedUser}
          units={activeUnits}
          isSelf={selectedUser.id === currentUser.id}
          onClose={() => setModal(null)}
          onSaved={(user) => {
            replaceUser(user);
            setModal(null);
            showToast.success(`Đã cập nhật tài khoản @${user.username}`);
          }}
        />
      )}
    </div>
  );
};
