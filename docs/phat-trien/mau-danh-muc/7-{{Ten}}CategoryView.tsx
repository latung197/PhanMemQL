// {{tenVi}} ({{ma}}) on the shared catalog screen: the screen only declares columns, form and Excel columns.
import React, { useMemo } from 'react';
import { {{Icon}} } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { TextArea, TextInput } from '../../../../components/common/FormField';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import type { UserProfile } from '../../../../types';
import { {{tens}}Api, type {{Ten}}Record, type Save{{Ten}}Input } from './api';

export const {{Ten}}CategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const toInput = (row: {{Ten}}Record): Save{{Ten}}Input => ({ code: row.code, name: row.name, note: row.note ?? '', isActive: row.isActive });
  const definition = useMemo((): CatalogDefinition<{{Ten}}Record, Save{{Ten}}Input> => ({
    functionCode: '{{ma}}', api: {{tens}}Api,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <{{Icon}} className="h-4 w-4" />,
    texts: {
      title: t('{{tens}}.title'), subtitle: t('{{tens}}.subtitle'), noun: t('{{tens}}.noun'),
      add: t('{{tens}}.add'), searchPlaceholder: t('{{tens}}.search'),
      addTitle: t('{{tens}}.addTitle'), editTitle: row => t('{{tens}}.editTitle', { code: row.code }),
      fileName: '{{tenFile}}'
    },
    columns: [
      { key: 'code', header: t('{{tens}}.code'), width: '140px', sortable: true, render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('{{tens}}.name'), sortable: true },
      { key: 'note', header: t('{{tens}}.note'), render: row => row.note || '—' },
      { key: 'isActive', header: t('{{tens}}.status'), align: 'center', width: '130px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('{{tens}}.inUse')}</Badge>
          : <Badge variant="slate" size="sm">{t('{{tens}}.notInUse')}</Badge> },
      ...recordStampColumns<{{Ten}}Record>(t)
    ],
    searchText: row => `${row.code} ${row.name} ${row.note ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('{{tens}}.code'), required: true, width: 16, example: 'MA01' },
        { key: 'name', header: t('{{tens}}.name'), required: true, width: 30, example: "" },
        { key: 'note', header: t('{{tens}}.note'), width: 20, example: '' },
        { key: 'isActive', header: t('{{tens}}.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: toInput
    },
    emptyInput: { code: '', name: '', note: '', isActive: true },
    toInput,
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), note: input.note.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <TextInput label={t('{{tens}}.code')} required autoFocus={!editing} disabled={!!editing} maxLength={20} className="font-mono uppercase"
          value={form.code} hint={t('{{tens}}.codeHint')} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
        <TextInput label={t('{{tens}}.name')} required autoFocus={!!editing} maxLength={200} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <TextArea label={t('{{tens}}.note')} rows={2} maxLength={300} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        <Checkbox label={t('{{tens}}.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
      </>
    ),
    formWidth: 'lg'
  }), [t]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
