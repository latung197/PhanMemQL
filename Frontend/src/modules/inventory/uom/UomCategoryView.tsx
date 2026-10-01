// Kho › Danh mục đơn vị tính (inv_uom_cat), backed by the API (erp_uom). Same model as the department catalog:
// useCatalog loads / saves / deletes with the usual messages; changes are logged automatically (Nhật ký thay đổi).
import React, { useState } from 'react';
import { Edit2, Plus, Ruler, Trash2 } from 'lucide-react';
import { GridView, GridViewColumn } from '../../../components/common/GridView';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Checkbox } from '../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../components/common/FormField';
import { ErrorState } from '../../../components/common/StateViews';
import { RecordStampLine } from '../../../components/common/RecordStamp';
import { recordStampColumns } from '../../../components/common/recordStampColumns';
import { useCatalog } from '../../../hooks/useCatalog';
import { useLanguage } from '../../../context/LanguageContext';
import { getActionPermission } from '../../../utils/permissions';
import { UserProfile } from '../../../types';
import { uomsApi } from './api';
import { SaveUomInput, Uom } from './types';

const EMPTY: SaveUomInput = { code: '', name: '', symbol: '', note: '', isActive: true };

export const UomCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const perms = getActionPermission(currentUser, 'inv_uom_cat');
  const catalog = useCatalog(uomsApi, { keyOf: u => u.code, noun: t('uoms.noun'), describe: u => `${u.code} - ${u.name}` });
  // null = form closed; `editing` undefined = new record.
  const [form, setForm] = useState<SaveUomInput | null>(null);
  const [editing, setEditing] = useState<Uom>();
  const [saving, setSaving] = useState(false);

  const open = (item?: Uom) => {
    setEditing(item);
    setForm(item ? { code: item.code, name: item.name, symbol: item.symbol, note: item.note ?? '', isActive: item.isActive } : EMPTY);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const input = { ...form, code: form.code.trim().toUpperCase(), name: form.name.trim(), symbol: form.symbol.trim() };
    if (await catalog.save(input, editing)) setForm(null);
    setSaving(false);
  };

  const columns: GridViewColumn<Uom>[] = [
    { key: 'code', header: t('uoms.code'), width: '120px', sortable: true, render: u => <span className="font-mono font-bold">{u.code}</span> },
    { key: 'name', header: t('uoms.name'), sortable: true },
    { key: 'symbol', header: t('uoms.symbol'), width: '120px', sortable: true, render: u => u.symbol || '—' },
    { key: 'note', header: t('uoms.note'), render: u => u.note || '—' },
    {
      key: 'isActive', header: t('uoms.status'), align: 'center', width: '140px',
      render: u => u.isActive
        ? <Badge variant="success" size="sm">{t('uoms.active')}</Badge>
        : <Badge variant="slate" size="sm">{t('uoms.inactive')}</Badge>
    },
    ...recordStampColumns<Uom>(t)
  ];

  if (catalog.error) return <ErrorState message={catalog.error} onRetry={() => void catalog.reload()} />;

  return (
    <>
      <GridView
        title={t('uoms.title')}
        subtitle={t('uoms.subtitle')}
        icon={<Ruler className="h-4 w-4" />}
        data={catalog.items}
        columns={columns}
        getItemId={u => u.code}
        loading={catalog.loading}
        searchPlaceholder={t('uoms.search')}
        primaryAction={perms.createEdit ? { label: t('uoms.add'), icon: <Plus className="h-3.5 w-3.5" />, onClick: () => open() } : undefined}
        actions={(perms.createEdit || perms.delete) ? u => (
          <div className="flex justify-end gap-1">
            {perms.createEdit && <Button variant="ghost" size="sm" title={t('uoms.edit')} onClick={() => open(u)} icon={<Edit2 className="h-3.5 w-3.5" />} />}
            {perms.delete && <Button variant="ghost" size="sm" title={t('uoms.delete')} onClick={() => void catalog.remove(u)} icon={<Trash2 className="h-3.5 w-3.5 text-rose-600" />} />}
          </div>
        ) : undefined}
      />

      {form && (
        <Modal isOpen onClose={() => setForm(null)} title={editing ? t('uoms.editTitle', { code: editing.code }) : t('uoms.addTitle')}>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextInput label={t('uoms.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20}
                className="font-mono uppercase" value={form.code} hint={t('uoms.codeHint')}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
              <TextInput label={t('uoms.symbol')} maxLength={20} value={form.symbol} placeholder={t('uoms.symbolPlaceholder')}
                hint={t('uoms.symbolHint')} onChange={e => setForm({ ...form, symbol: e.target.value })} />
            </div>
            <TextInput label={t('uoms.name')} required maxLength={100} value={form.name} autoFocus={!!editing}
              placeholder={t('uoms.namePlaceholder')} onChange={e => setForm({ ...form, name: e.target.value })} />
            <TextArea label={t('uoms.note')} rows={2} maxLength={300} value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })} />
            <Checkbox label={t('uoms.isActive')} subLabel={t('uoms.isActiveHint')}
              checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
            <RecordStampLine stamp={editing?.stamp} />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(null)}>{t('uoms.cancel')}</Button>
              <Button type="submit" size="sm" disabled={saving}>{saving ? t('uoms.saving') : t('uoms.save')}</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};
