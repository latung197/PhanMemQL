// Settings › Ngoại tệ (sys_currencies).
import React, { useState } from 'react';
import { Check, Coins, Edit2, Plus, Trash2 } from 'lucide-react';
import { GridView, GridViewColumn } from '../../components/common/GridView';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Checkbox } from '../../components/common/Checkbox';
import { SelectInput, TextInput } from '../../components/common/FormField';
import { ErrorState } from '../../components/common/StateViews';
import { currenciesApi, Currency } from '../../services/settingsApi';
import { useCatalog } from '../../hooks/useCatalog';
import { SettingsViewProps } from './settingsTypes';

const EMPTY: Currency = { code: '', name: '', symbol: '', decimalPlaces: 2, isBase: false, isActive: true };

export const CurrencyCategoryView: React.FC<SettingsViewProps> = ({ canEdit, canDelete }) => {
  const catalog = useCatalog(currenciesApi, { keyOf: c => c.code, noun: 'ngoại tệ', describe: c => c.code });
  const [form, setForm] = useState<Currency | null>(null);
  const [editing, setEditing] = useState<Currency>();
  const [saving, setSaving] = useState(false);

  const open = (item?: Currency) => {
    setEditing(item);
    setForm(item ? { ...item } : EMPTY);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    if (await catalog.save({ ...form, code: form.code.trim().toUpperCase(), name: form.name.trim() }, editing)) setForm(null);
    setSaving(false);
  };

  const columns: GridViewColumn<Currency>[] = [
    { key: 'code', header: 'Mã', width: '100px', sortable: true, render: c => <span className="font-mono font-bold">{c.code}</span> },
    { key: 'name', header: 'Tên ngoại tệ', sortable: true },
    { key: 'symbol', header: 'Ký hiệu', align: 'center', width: '90px' },
    { key: 'decimalPlaces', header: 'Số lẻ', align: 'center', width: '80px' },
    {
      key: 'isBase', header: 'Tiền hạch toán', align: 'center', width: '140px',
      render: c => c.isBase ? <Badge variant="success" size="sm"><Check className="h-3 w-3" /> Hạch toán</Badge> : null
    },
    {
      key: 'isActive', header: 'Trạng thái', align: 'center', width: '130px',
      render: c => c.isActive ? <Badge variant="success" size="sm">Đang dùng</Badge> : <Badge variant="slate" size="sm">Ngừng sử dụng</Badge>
    }
  ];

  if (catalog.error) return <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} />;

  return (
    <>
      <GridView
        title="Danh mục ngoại tệ"
        subtitle="Đồng tiền hạch toán dùng để ghi sổ; các ngoại tệ khác quy đổi theo tỷ giá."
        icon={<Coins className="h-4 w-4" />}
        data={catalog.items}
        columns={columns}
        getItemId={c => c.code}
        loading={catalog.loading}
        paginated={false}
        searchPlaceholder="Tìm mã hoặc tên ngoại tệ..."
        primaryAction={canEdit ? { label: 'Thêm ngoại tệ', icon: <Plus className="h-3.5 w-3.5" />, onClick: () => open() } : undefined}
        actions={(canEdit || canDelete) ? c => (
          <div className="flex justify-end gap-1">
            {canEdit && <Button variant="ghost" size="sm" title="Sửa" onClick={() => open(c)} icon={<Edit2 className="h-3.5 w-3.5" />} />}
            {canDelete && !c.isBase && (
              <Button variant="ghost" size="sm" title="Xóa" onClick={() => void catalog.remove(c)} icon={<Trash2 className="h-3.5 w-3.5 text-rose-600" />} />
            )}
          </div>
        ) : undefined}
      />

      {form && (
        <Modal isOpen onClose={() => setForm(null)} title={editing ? `Sửa ngoại tệ ${editing.code}` : 'Thêm ngoại tệ'}>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Mã (ISO)" required autoFocus={!editing} disabled={!!editing} maxLength={10}
                className="font-mono uppercase" placeholder="USD" value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              <TextInput label="Ký hiệu" maxLength={10} placeholder="$" value={form.symbol}
                onChange={e => setForm({ ...form, symbol: e.target.value })} />
            </div>
            <TextInput label="Tên ngoại tệ" required maxLength={100} value={form.name} autoFocus={!!editing}
              onChange={e => setForm({ ...form, name: e.target.value })} />
            <SelectInput label="Số chữ số thập phân" value={String(form.decimalPlaces)}
              onChange={e => setForm({ ...form, decimalPlaces: Number(e.target.value) })}
              options={[0, 1, 2, 3, 4].map(n => ({ value: String(n), label: `${n} chữ số` }))} />
            <Checkbox label="Đồng tiền hạch toán" subLabel="Chỉ có một đồng tiền hạch toán; chọn đồng tiền này sẽ bỏ chọn đồng tiền cũ"
              checked={form.isBase} disabled={editing?.isBase} onChange={isBase => setForm({ ...form, isBase })} />
            <Checkbox label="Đang sử dụng" checked={form.isActive || form.isBase} disabled={form.isBase}
              onChange={isActive => setForm({ ...form, isActive })} />
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
