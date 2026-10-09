import React, { useEffect, useMemo, useState } from 'react';
import { Tags } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../../components/common/FormField';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import { authService, type LanguageOption } from '../../../../services/authService';
import type { UserProfile } from '../../../../types';
import { warehouseTypesApi } from './api';
import type { SaveWarehouseTypeInput, WarehouseTypeRecord } from './types';

export const WarehouseTypeCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [languages, setLanguages] = useState<LanguageOption[]>([]);

  useEffect(() => {
    let active = true;
    void authService.getLanguages().then(items => {
      if (active) setLanguages(items.filter(item => item.code.toLowerCase().split('-')[0] !== 'vi'));
    }).catch(() => { /* The catalog remains usable if language options cannot load. */ });
    return () => { active = false; };
  }, []);

  const definition = useMemo((): CatalogDefinition<WarehouseTypeRecord, SaveWarehouseTypeInput> => ({
    functionCode: 'inv_warehouse_type_cat', api: warehouseTypesApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <Tags className="h-4 w-4" />,
    texts: {
      title: t('warehouseTypes.title'), subtitle: t('warehouseTypes.subtitle'), noun: t('warehouseTypes.noun'),
      add: t('warehouseTypes.add'), searchPlaceholder: t('warehouseTypes.search'),
      addTitle: t('warehouseTypes.addTitle'), editTitle: row => t('warehouseTypes.editTitle', { code: row.code }),
      fileName: 'DanhMucLoaiKho'
    },
    columns: [
      { key: 'code', header: t('warehouseTypes.code'), width: '150px', sortable: true,
        render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'localizedName', header: t('warehouseTypes.name'), sortable: true,
        render: row => row.localizedName || row.name },
      { key: 'note', header: t('warehouseTypes.note'), render: row => row.note || '—' },
      { key: 'isActive', header: t('warehouseTypes.status'), align: 'center', width: '140px',
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('warehouseTypes.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('warehouseTypes.inactive')}</Badge> },
      ...recordStampColumns<WarehouseTypeRecord>(t)
    ],
    searchText: row => `${row.code} ${row.name} ${row.localizedName} ${row.translations.map(item => item.name).join(' ')} ${row.note ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('warehouseTypes.code'), required: true, width: 20, example: 'KHO-THANH-PHAM' },
        { key: 'name', header: t('warehouseTypes.name'), required: true, width: 32, example: 'Kho thành phẩm' },
        { key: 'note', header: t('warehouseTypes.note'), width: 40, example: '' },
        { key: 'isActive', header: t('warehouseTypes.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: row => ({ code: row.code, name: row.name, note: row.note ?? '', isActive: row.isActive })
    },
    emptyInput: { code: '', name: '', note: '', isActive: true, translations: [] },
    toInput: row => ({ code: row.code, name: row.name, note: row.note ?? '',
      isActive: row.isActive, translations: row.translations }),
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(),
      note: input.note.trim(), translations: input.translations?.map(item => ({ ...item, name: item.name.trim() })).filter(item => item.name) }),
    renderForm: ({ form, setForm, editing }) => <>
      <TextInput label={t('warehouseTypes.code')} required autoFocus={!editing} disabled={!!editing}
        maxLength={20} value={form.code} hint={t('warehouseTypes.codeHint')}
        onChange={event => setForm({ ...form, code: event.target.value.toUpperCase().replace(/\s/g, '') })} />
      <TextInput label={t('warehouseTypes.baseName')} required autoFocus={!!editing} maxLength={100}
        value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
      {languages.length > 0 && <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('warehouseTypes.translations')}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('warehouseTypes.translationHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {languages.map(item => <TextInput key={item.code}
            label={`${t('warehouseTypes.name')} (${item.nativeName})`} maxLength={100}
            value={form.translations?.find(value => value.languageCode === item.code)?.name ?? ''}
            onChange={event => {
              const translations = (form.translations ?? []).filter(value => value.languageCode !== item.code);
              if (event.target.value) translations.push({ languageCode: item.code, name: event.target.value });
              setForm({ ...form, translations });
            }} />)}
        </div>
      </div>}
      <TextArea label={t('warehouseTypes.note')} rows={2} maxLength={300} value={form.note}
        onChange={event => setForm({ ...form, note: event.target.value })} />
      <Checkbox label={t('warehouseTypes.isActive')} checked={form.isActive}
        onChange={isActive => setForm({ ...form, isActive })} />
    </>
  }), [t, languages]);

  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
