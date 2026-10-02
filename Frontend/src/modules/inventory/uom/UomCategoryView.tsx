// Kho › Danh mục đơn vị tính (inv_uom_cat), backed by the API (erp_uom). The model for catalogs: the screen only
// declares its columns, form and Excel columns; CatalogScreen does the rest (search, filters, Excel import / export,
// bulk delete, permissions, change log, lost-update protection). See docs/them-danh-muc.md.
import React, { useMemo } from 'react';
import { Ruler } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Checkbox } from '../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../components/common/FormField';
import { recordStampColumns } from '../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../context/LanguageContext';
import { UserProfile } from '../../../types';
import { uomsApi } from './api';
import { SaveUomInput, Uom } from './types';

export const UomCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();

  const definition = useMemo((): CatalogDefinition<Uom, SaveUomInput> => ({
    functionCode: 'inv_uom_cat',
    api: uomsApi,
    keyOf: u => u.code,
    describe: u => `${u.code} - ${u.name}`,
    icon: <Ruler className="h-4 w-4" />,
    texts: {
      title: t('uoms.title'),
      subtitle: t('uoms.subtitle'),
      noun: t('uoms.noun'),
      add: t('uoms.add'),
      searchPlaceholder: t('uoms.search'),
      addTitle: t('uoms.addTitle'),
      editTitle: u => t('uoms.editTitle', { code: u.code }),
      fileName: 'DanhMucDonViTinh'
    },
    columns: [
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
    ],
    searchText: u => `${u.code} ${u.name} ${u.symbol} ${u.note ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('uoms.code'), required: true, width: 16, example: 'HOP' },
        { key: 'name', header: t('uoms.name'), required: true, width: 28, example: 'Hộp' },
        { key: 'symbol', header: t('uoms.symbol'), width: 12, example: 'hộp' },
        { key: 'note', header: t('uoms.note'), width: 40, example: 'Đóng gói quy cách vừa' },
        { key: 'isActive', header: t('uoms.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: u => ({ code: u.code, name: u.name, symbol: u.symbol, note: u.note ?? '', isActive: u.isActive })
    },
    emptyInput: { code: '', name: '', symbol: '', note: '', isActive: true },
    toInput: u => ({ code: u.code, name: u.name, symbol: u.symbol, note: u.note ?? '', isActive: u.isActive }),
    normalize: x => ({ ...x, code: x.code.trim().toUpperCase(), name: x.name.trim(), symbol: (x.symbol ?? '').trim(), note: x.note ?? '' }),
    renderForm: ({ form, setForm, editing }) => (
      <>
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
      </>
    )
  }), [t]);

  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
