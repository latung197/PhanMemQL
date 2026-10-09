// Settings › Danh mục ngôn ngữ (sys_languages), on the shared catalog screen: the languages users may work in, one of
// them the default. A language's screen texts come from locales/<code>.json; without that file its screens show Vietnamese.
import React, { useMemo } from 'react';
import { Check, Languages } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Checkbox } from '../../components/common/Checkbox';
import { TextInput } from '../../components/common/FormField';
import { recordStampColumns } from '../../components/common/recordStampColumns';
import { CatalogScreen } from '../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../components/catalog/catalogTypes';
import { useLanguage } from '../../context/LanguageContext';
import { languagesApi, type LanguageRow, type SaveLanguageInput } from '../../services/settingsApi';
import { translations } from '../../utils/i18n';
import type { UserProfile } from '../../types';

/** Screen texts exist for the language (locales/<code>.json), otherwise its screens fall back to Vietnamese. */
const hasScreenTexts = (code: string) => code in translations;

export const LanguageCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const definition = useMemo((): CatalogDefinition<LanguageRow, SaveLanguageInput> => ({
    functionCode: 'sys_languages', api: languagesApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
    icon: <Languages className="h-4 w-4" />,
    texts: {
      title: t('languages.title'), subtitle: t('languages.subtitle'), noun: t('languages.noun'),
      add: t('languages.add'), searchPlaceholder: t('languages.search'),
      addTitle: t('languages.addTitle'), editTitle: row => t('languages.editTitle', { code: row.code }),
      fileName: 'DanhMucNgonNgu'
    },
    columns: [
      { key: 'code', header: t('languages.code'), width: '110px', sortable: true,
        render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'name', header: t('languages.name'), sortable: true },
      { key: 'nativeName', header: t('languages.nativeName'), sortable: true },
      { key: 'isDefault', header: t('languages.isDefault'), align: 'center', width: '130px', sortable: true,
        render: row => row.isDefault ? <Badge variant="success" size="sm"><Check className="h-3 w-3" /> {t('languages.isDefault')}</Badge> : null },
      { key: 'texts', header: t('languages.texts'), align: 'center', width: '190px',
        render: row => hasScreenTexts(row.code)
          ? <Badge variant="success" size="sm">{t('languages.textsYes')}</Badge>
          : <Badge variant="warning" size="sm" title={t('languages.textsNoHint', { code: row.code })}>{t('languages.textsNo')}</Badge> },
      { key: 'userCount', header: t('languages.userCount'), align: 'center', width: '140px' },
      { key: 'isActive', header: t('languages.status'), align: 'center', width: '140px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('languages.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('languages.inactive')}</Badge> },
      ...recordStampColumns<LanguageRow>(t)
    ],
    excel: {
      columns: [
        { key: 'code', header: t('languages.code'), required: true, width: 14, example: 'ja' },
        { key: 'name', header: t('languages.name'), required: true, width: 24, example: 'Tiếng Nhật' },
        { key: 'nativeName', header: t('languages.nativeName'), required: true, width: 28, example: '日本語' },
        { key: 'isDefault', header: t('languages.isDefault'), type: 'boolean', width: 14, example: false },
        { key: 'isActive', header: t('languages.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: row => ({ code: row.code, name: row.name, nativeName: row.nativeName, isDefault: row.isDefault, isActive: row.isActive })
    },
    emptyInput: { code: '', name: '', nativeName: '', isActive: true, isDefault: false },
    toInput: row => ({ code: row.code, name: row.name, nativeName: row.nativeName, isActive: row.isActive, isDefault: row.isDefault }),
    normalize: input => ({ ...input, code: input.code.trim().toLowerCase(), name: input.name.trim(), nativeName: input.nativeName.trim() }),
    renderForm: ({ form, setForm, editing }) => (
      <>
        <TextInput label={t('languages.code')} required autoFocus={!editing} disabled={!!editing} maxLength={10}
          className="font-mono lowercase" value={form.code} hint={t('languages.codeHint')}
          onChange={e => setForm({ ...form, code: e.target.value.toLowerCase().replace(/\s/g, '') })} />
        <TextInput label={t('languages.name')} required maxLength={50} value={form.name} autoFocus={!!editing}
          placeholder={t('languages.namePlaceholder')} onChange={e => setForm({ ...form, name: e.target.value })} />
        <TextInput label={t('languages.nativeName')} required maxLength={50} value={form.nativeName}
          placeholder="日本語" hint={t('languages.nativeNameHint')}
          onChange={e => setForm({ ...form, nativeName: e.target.value })} />
        <Checkbox label={t('languages.isDefaultLabel')} subLabel={t('languages.isDefaultHint')}
          checked={form.isDefault} disabled={editing?.isDefault} onChange={isDefault => setForm({ ...form, isDefault })} />
        <Checkbox label={t('languages.isActive')} subLabel={t('languages.isActiveHint')}
          checked={form.isActive || form.isDefault} disabled={form.isDefault} onChange={isActive => setForm({ ...form, isActive })} />
      </>
    )
  }), [t]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
