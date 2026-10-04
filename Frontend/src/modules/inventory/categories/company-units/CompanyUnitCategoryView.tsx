import React, { useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { SelectInput, TextInput } from '../../../../components/common/FormField';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import { authService, type LanguageOption } from '../../../../services/authService';
import { companyUnitsApi, type SaveCompanyUnitInput } from '../../../../services/settingsApi';
import type { CompanyUnit, UserProfile } from '../../../../types';

const ACTIVE = 'Hoạt động';
const PAUSED = 'Tạm dừng';

export const CompanyUnitCategoryView: React.FC<{
  currentUser?: UserProfile;
  onChanged?: () => void | Promise<void>;
}> = ({ currentUser, onChanged }) => {
  const { t } = useLanguage();
  const [languages, setLanguages] = useState<LanguageOption[]>([]);

  useEffect(() => {
    let active = true;
    void authService.getLanguages().then(items => {
      if (active) setLanguages(items.filter(item => item.code.toLowerCase().split('-')[0] !== 'vi'));
    }).catch(() => { /* The base name remains available. */ });
    return () => { active = false; };
  }, []);

  const definition = useMemo((): CatalogDefinition<CompanyUnit, SaveCompanyUnitInput> => ({
    functionCode: 'inv_company_unit_cat',
    api: companyUnitsApi,
    keyOf: unit => unit.code,
    describe: unit => `${unit.code} - ${unit.name}`,
    icon: <Building2 className="h-4 w-4" />,
    texts: {
      title: t('companyUnits.title'), subtitle: t('companyUnits.subtitle'), noun: t('companyUnits.noun'),
      add: t('companyUnits.add'), searchPlaceholder: t('companyUnits.search'),
      addTitle: t('companyUnits.addTitle'), editTitle: unit => t('companyUnits.editTitle', { code: unit.code }),
      fileName: 'DanhMucDonViCoSo'
    },
    columns: [
      { key: 'code', header: t('companyUnits.code'), width: '135px', sortable: true,
        render: unit => <span className="font-mono font-bold">{unit.code}</span> },
      { key: 'localizedName', header: t('companyUnits.name'), sortable: true,
        render: unit => unit.localizedName || unit.name },
      { key: 'shortName', header: t('companyUnits.shortName'), render: unit => unit.shortName || '—' },
      { key: 'address', header: t('companyUnits.address'), render: unit => unit.address || '—' },
      { key: 'taxCode', header: t('companyUnits.taxCode'), render: unit => unit.taxCode || '—' },
      { key: 'isDefault', header: t('companyUnits.default'), width: '110px', align: 'center',
        render: unit => unit.isDefault ? <Badge variant="info" size="sm">{t('companyUnits.default')}</Badge> : '—' },
      { key: 'isActive', header: t('companyUnits.status'), width: '125px', align: 'center',
        render: unit => unit.isActive
          ? <Badge variant="success" size="sm">{t('companyUnits.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('companyUnits.paused')}</Badge> }
    ],
    searchText: unit => `${unit.code} ${unit.name} ${unit.localizedName ?? ''} ${unit.shortName ?? ''} ` +
      `${unit.translations?.map(item => item.name).join(' ') ?? ''} ${unit.address ?? ''} ${unit.taxCode ?? ''}`,
    excel: {
      columns: [
        { key: 'code', header: t('companyUnits.code'), required: true, width: 18, example: 'CN-HCM' },
        { key: 'name', header: t('companyUnits.baseName'), required: true, width: 34, example: 'Chi nhánh Hồ Chí Minh' },
        { key: 'shortName', header: t('companyUnits.shortName'), width: 20, example: 'CN HCM' },
        { key: 'address', header: t('companyUnits.address'), width: 40, example: '' },
        { key: 'phone', header: t('companyUnits.phone'), width: 20, example: '' },
        { key: 'email', header: t('companyUnits.email'), width: 28, example: '' },
        { key: 'taxCode', header: t('companyUnits.taxCode'), width: 20, example: '' },
        { key: 'status', header: t('companyUnits.status'), width: 16, example: ACTIVE },
        { key: 'isDefault', header: t('companyUnits.default'), type: 'boolean', width: 16, example: false }
      ],
      toRow: unit => ({ code: unit.code, name: unit.name, shortName: unit.shortName ?? '',
        address: unit.address ?? '', phone: unit.phone ?? '', email: unit.email ?? '', taxCode: unit.taxCode ?? '',
        status: unit.status, isDefault: !!unit.isDefault })
    },
    emptyInput: { code: '', name: '', shortName: '', address: '', phone: '', email: '', taxCode: '',
      status: ACTIVE, isDefault: false },
    toInput: unit => ({ code: unit.code, name: unit.name, shortName: unit.shortName ?? '',
      address: unit.address ?? '', phone: unit.phone ?? '', email: unit.email ?? '', taxCode: unit.taxCode ?? '',
      status: unit.status, isDefault: !!unit.isDefault, translations: unit.translations ?? [] }),
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(),
      shortName: input.shortName?.trim(), address: input.address?.trim(), phone: input.phone?.trim(),
      email: input.email?.trim(), taxCode: input.taxCode?.trim(),
      translations: input.translations?.map(item => ({ ...item, name: item.name.trim() })).filter(item => item.name) }),
    renderForm: ({ form, setForm, editing }) => <>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label={t('companyUnits.code')} required maxLength={20} autoFocus={!editing}
          disabled={!!editing} value={form.code}
          onChange={event => setForm({ ...form, code: event.target.value.toUpperCase().replace(/\s/g, '') })} />
        <TextInput label={t('companyUnits.shortName')} maxLength={100} value={form.shortName ?? ''}
          onChange={event => setForm({ ...form, shortName: event.target.value })} />
      </div>
      <TextInput label={t('companyUnits.baseName')} required maxLength={150} autoFocus={!!editing}
        value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
      {languages.length > 0 && <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('companyUnits.translations')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {languages.map(language => <TextInput key={language.code}
            label={`${t('companyUnits.name')} (${language.nativeName})`} maxLength={150}
            value={form.translations?.find(item => item.languageCode === language.code)?.name ?? ''}
            onChange={event => {
              const translations = (form.translations ?? []).filter(item => item.languageCode !== language.code);
              if (event.target.value) translations.push({ languageCode: language.code, name: event.target.value });
              setForm({ ...form, translations });
            }} />)}
        </div>
      </div>}
      <TextInput label={t('companyUnits.address')} maxLength={300} value={form.address ?? ''}
        onChange={event => setForm({ ...form, address: event.target.value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label={t('companyUnits.phone')} maxLength={30} value={form.phone ?? ''}
          onChange={event => setForm({ ...form, phone: event.target.value })} />
        <TextInput label={t('companyUnits.email')} type="email" maxLength={150} value={form.email ?? ''}
          onChange={event => setForm({ ...form, email: event.target.value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label={t('companyUnits.taxCode')} maxLength={30} value={form.taxCode ?? ''}
          onChange={event => setForm({ ...form, taxCode: event.target.value })} />
        <SelectInput label={t('companyUnits.status')} value={form.status}
          options={[{ value: ACTIVE, label: t('companyUnits.active') },
            { value: PAUSED, label: t('companyUnits.paused') }]}
          onChange={event => setForm({ ...form, status: event.target.value as CompanyUnit['status'] })} />
      </div>
      <Checkbox label={t('companyUnits.default')} checked={!!form.isDefault}
        onChange={isDefault => setForm({ ...form, isDefault })} />
    </>,
    formWidth: '2xl'
  }), [t, languages]);

  return <CatalogScreen definition={definition} currentUser={currentUser} onChanged={onChanged} />;
};
