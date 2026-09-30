// Settings › Danh mục phòng ban. The smallest complete API-backed catalog: copy it for a new catalog.
import React, { useState } from 'react';
import { Edit2, Network, Plus, Trash2 } from 'lucide-react';
import { GridView, GridViewColumn } from '../../components/common/GridView';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Checkbox } from '../../components/common/Checkbox';
import { TextArea, TextInput } from '../../components/common/FormField';
import { ErrorState } from '../../components/common/StateViews';
import { Department, departmentsApi, SaveDepartmentInput } from '../../services/settingsApi';
import { useCatalog } from '../../hooks/useCatalog';
import { SettingsViewProps } from './settingsTypes';

const EMPTY: SaveDepartmentInput = { code: '', name: '', note: '', isActive: true };

export const DepartmentCategoryView: React.FC<SettingsViewProps> = ({ canEdit, canDelete }) => {
  const catalog = useCatalog(departmentsApi, { keyOf: d => d.code, noun: 'phòng ban', describe: d => `${d.code} - ${d.name}` });
  // null = form closed; `editing` undefined = new record.
  const [form, setForm] = useState<SaveDepartmentInput | null>(null);
  const [editing, setEditing] = useState<Department>();
  const [saving, setSaving] = useState(false);

  const open = (item?: Department) => {
    setEditing(item);
    setForm(item ? { code: item.code, name: item.name, note: item.note ?? '', isActive: item.isActive } : EMPTY);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    if (await catalog.save({ ...form, code: form.code.trim().toUpperCase(), name: form.name.trim() }, editing)) setForm(null);
    setSaving(false);
  };

  const columns: GridViewColumn<Department>[] = [
    { key: 'code', header: 'Mã', width: '120px', sortable: true, render: d => <span className="font-mono font-bold">{d.code}</span> },
    { key: 'name', header: 'Tên phòng ban', sortable: true },
    { key: 'userCount', header: 'Số người dùng', align: 'center', width: '130px', sortable: true },
    { key: 'note', header: 'Ghi chú', render: d => d.note || '—' },
    {
      key: 'isActive', header: 'Trạng thái', align: 'center', width: '130px',
      render: d => d.isActive ? <Badge variant="success" size="sm">Đang dùng</Badge> : <Badge variant="slate" size="sm">Ngừng sử dụng</Badge>
    }
  ];

  if (catalog.error) return <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} />;

  return (
    <>
      <GridView
        title="Danh mục phòng ban"
        subtitle="Phòng ban của nhân viên; dùng khi gán tài khoản và trong quy trình phê duyệt theo phòng ban."
        icon={<Network className="h-4 w-4" />}
        data={catalog.items}
        columns={columns}
        getItemId={d => d.code}
        loading={catalog.loading}
        searchPlaceholder="Tìm mã hoặc tên phòng ban..."
        primaryAction={canEdit ? { label: 'Thêm phòng ban', icon: <Plus className="h-3.5 w-3.5" />, onClick: () => open() } : undefined}
        actions={(canEdit || canDelete) ? d => (
          <div className="flex justify-end gap-1">
            {canEdit && <Button variant="ghost" size="sm" title="Sửa" onClick={() => open(d)} icon={<Edit2 className="h-3.5 w-3.5" />} />}
            {canDelete && <Button variant="ghost" size="sm" title="Xóa" onClick={() => void catalog.remove(d)} icon={<Trash2 className="h-3.5 w-3.5 text-rose-600" />} />}
          </div>
        ) : undefined}
      />

      {form && (
        <Modal isOpen onClose={() => setForm(null)} title={editing ? `Sửa phòng ban ${editing.code}` : 'Thêm phòng ban'}>
          <form onSubmit={submit} className="space-y-3">
            <TextInput label="Mã phòng ban" required autoFocus={!editing} disabled={!!editing} maxLength={20}
              className="font-mono uppercase" value={form.code} hint="Không đổi được sau khi tạo"
              onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            <TextInput label="Tên phòng ban" required maxLength={100} value={form.name} autoFocus={!!editing}
              onChange={e => setForm({ ...form, name: e.target.value })} />
            <TextArea label="Ghi chú" rows={2} maxLength={300} value={form.note ?? ''}
              onChange={e => setForm({ ...form, note: e.target.value })} />
            <Checkbox label="Đang sử dụng" subLabel="Phòng ban ngừng sử dụng không chọn được cho tài khoản mới"
              checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(null)}>Hủy</Button>
              <Button type="submit" size="sm" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};
