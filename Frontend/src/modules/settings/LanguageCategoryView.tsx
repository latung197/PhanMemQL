// Settings › Danh mục ngôn ngữ (sys_languages): the languages users may work in, one of them the default.
// A language's screen texts come from locales/<code>.json; without that file its screens show Vietnamese.
import React, { useState } from 'react';
import { Check, Edit2, Languages, Plus, Trash2 } from 'lucide-react';
import { GridView, GridViewColumn } from '../../components/common/GridView';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Checkbox } from '../../components/common/Checkbox';
import { TextInput } from '../../components/common/FormField';
import { ErrorState } from '../../components/common/StateViews';
import { Language, languagesApi, SaveLanguageInput } from '../../services/settingsApi';
import { useCatalog } from '../../hooks/useCatalog';
import { translations } from '../../utils/i18n';
import { SettingsViewProps } from './settingsTypes';

const EMPTY: SaveLanguageInput = { code: '', name: '', nativeName: '', isActive: true, isDefault: false };

/** Screen texts exist for the language (locales/<code>.json), otherwise its screens fall back to Vietnamese. */
const hasScreenTexts = (code: string) => code in translations;

export const LanguageCategoryView: React.FC<SettingsViewProps> = ({ canEdit, canDelete }) => {
  const catalog = useCatalog(languagesApi, { keyOf: l => l.code, noun: 'ngôn ngữ', describe: l => `${l.code} - ${l.name}` });
  // null = form closed; `editing` undefined = new record.
  const [form, setForm] = useState<SaveLanguageInput | null>(null);
  const [editing, setEditing] = useState<Language>();
  const [saving, setSaving] = useState(false);

  const open = (item?: Language) => {
    setEditing(item);
    setForm(item ? { code: item.code, name: item.name, nativeName: item.nativeName, isActive: item.isActive, isDefault: item.isDefault } : EMPTY);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const input = { ...form, code: form.code.trim().toLowerCase(), name: form.name.trim(), nativeName: form.nativeName.trim() };
    if (await catalog.save(input, editing)) {
      setForm(null);
      // A new default language changes the default of other rows: reload them.
      if (input.isDefault && !editing?.isDefault) void catalog.reload();
    }
    setSaving(false);
  };

  const columns: GridViewColumn<Language>[] = [
    { key: 'code', header: 'Mã', width: '90px', sortable: true, render: l => <span className="font-mono font-bold">{l.code}</span> },
    { key: 'name', header: 'Tên ngôn ngữ', sortable: true },
    { key: 'nativeName', header: 'Tên bằng chính ngôn ngữ đó', sortable: true },
    {
      key: 'isDefault', header: 'Mặc định', align: 'center', width: '120px',
      render: l => l.isDefault ? <Badge variant="success" size="sm"><Check className="h-3 w-3" /> Mặc định</Badge> : null
    },
    {
      key: 'texts', header: 'Văn bản giao diện', align: 'center', width: '160px',
      render: l => hasScreenTexts(l.code)
        ? <Badge variant="success" size="sm">Đã có</Badge>
        : <Badge variant="warning" size="sm" title={`Chưa có file locales/${l.code}.json: màn hình hiện tiếng Việt`}>Chưa có, hiện tiếng Việt</Badge>
    },
    { key: 'userCount', header: 'Người dùng chọn', align: 'center', width: '130px', sortable: true },
    {
      key: 'isActive', header: 'Trạng thái', align: 'center', width: '130px',
      render: l => l.isActive ? <Badge variant="success" size="sm">Đang dùng</Badge> : <Badge variant="slate" size="sm">Ngừng sử dụng</Badge>
    }
  ];

  if (catalog.error) return <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} />;

  return (
    <>
      <GridView
        title="Danh mục ngôn ngữ"
        subtitle="Ngôn ngữ người dùng chọn được trên thanh tiêu đề. Ngôn ngữ mặc định dùng cho người chưa tự chọn và khi thiếu bản dịch."
        icon={<Languages className="h-4 w-4" />}
        data={catalog.items}
        columns={columns}
        getItemId={l => l.code}
        loading={catalog.loading}
        searchPlaceholder="Tìm mã hoặc tên ngôn ngữ..."
        primaryAction={canEdit ? { label: 'Thêm ngôn ngữ', icon: <Plus className="h-3.5 w-3.5" />, onClick: () => open() } : undefined}
        actions={(canEdit || canDelete) ? l => (
          <div className="flex justify-end gap-1">
            {canEdit && <Button variant="ghost" size="sm" title="Sửa" onClick={() => open(l)} icon={<Edit2 className="h-3.5 w-3.5" />} />}
            {canDelete && !l.isDefault && (
              <Button variant="ghost" size="sm" title="Xóa" onClick={() => void catalog.remove(l)} icon={<Trash2 className="h-3.5 w-3.5 text-rose-600" />} />
            )}
          </div>
        ) : undefined}
      />

      {form && (
        <Modal isOpen onClose={() => setForm(null)} title={editing ? `Sửa ngôn ngữ ${editing.code}` : 'Thêm ngôn ngữ'}>
          <form onSubmit={submit} className="space-y-3">
            <TextInput label="Mã ngôn ngữ" required autoFocus={!editing} disabled={!!editing} maxLength={10}
              className="font-mono lowercase" value={form.code} hint="Theo chuẩn quốc tế, ví dụ vi, en, ja, zh-cn. Không đổi được sau khi tạo"
              onChange={e => setForm({ ...form, code: e.target.value.toLowerCase() })} />
            <TextInput label="Tên ngôn ngữ" required maxLength={50} value={form.name} autoFocus={!!editing}
              placeholder="Tiếng Nhật" onChange={e => setForm({ ...form, name: e.target.value })} />
            <TextInput label="Tên bằng chính ngôn ngữ đó" required maxLength={50} value={form.nativeName}
              placeholder="日本語" hint="Hiện trong ô chọn ngôn ngữ trên thanh tiêu đề"
              onChange={e => setForm({ ...form, nativeName: e.target.value })} />
            <Checkbox label="Ngôn ngữ mặc định" subLabel="Dùng cho người chưa tự chọn ngôn ngữ và khi thiếu bản dịch"
              checked={form.isDefault} disabled={editing?.isDefault} onChange={isDefault => setForm({ ...form, isDefault })} />
            <Checkbox label="Đang sử dụng" subLabel="Ngôn ngữ ngừng sử dụng không chọn được nữa; người đang dùng chuyển về ngôn ngữ mặc định"
              checked={form.isActive || form.isDefault} disabled={form.isDefault} onChange={isActive => setForm({ ...form, isActive })} />
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
