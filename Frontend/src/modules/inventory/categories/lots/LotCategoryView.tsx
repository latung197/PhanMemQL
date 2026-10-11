// Kho › Lô và hạn sử dụng (inv_lot_cat), on the shared catalog screen. A lot is keyed by material + lot number
// ("VT001@LOT-2610"), fixed once saved; only a material tracked by lot can get lots. See docs/phat-trien/them-danh-muc.md.
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../../../components/common/Badge';
import { Checkbox } from '../../../../components/common/Checkbox';
import { SelectInput, TextArea, TextInput } from '../../../../components/common/FormField';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { CatalogLookup, lookupApi } from '../../../../components/catalog/CatalogLookup';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition, CatalogFilter } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import { formatDate } from '../../../../utils/format';
import type { UserProfile } from '../../../../types';
import { lotsApi } from './api';
import type { LotExpiryState, LotQuality, LotRecord, SaveLotInput } from './types';

const EXPIRY_VARIANT: Record<LotExpiryState, BadgeVariant> = { none: 'slate', ok: 'success', near: 'warning', expired: 'danger' };
const QUALITY_VARIANT: Record<LotQuality, BadgeVariant> = { PASSED: 'success', INSPECT: 'warning', BLOCKED: 'danger' };
const day = (value: string | null | undefined) => (value ? String(value).trim().slice(0, 10) : null);

export const LotCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [materialOptions, setMaterialOptions] = useState<{ value: string; label: string }[]>([]);

  // Choices of the material filter: the materials tracked by lot (read through the lookup).
  useEffect(() => {
    let alive = true;
    void lookupApi.search('materials', '', 1, 200, true, { tracking: 'lot' })
      .then(page => { if (alive) setMaterialOptions(page.items.map(x => ({ value: x.code, label: `${x.code} - ${x.name}` }))); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const definition = useMemo((): CatalogDefinition<LotRecord, SaveLotInput> => {
    const qualityLabel = (q: LotQuality) =>
      q === 'PASSED' ? t('lots.qualityPassed') : q === 'INSPECT' ? t('lots.qualityInspect') : t('lots.qualityBlocked');
    const expiryLabel = (s: LotExpiryState) =>
      s === 'ok' ? t('lots.expiryOk') : s === 'near' ? t('lots.expiryNear') : s === 'expired' ? t('lots.expiryExpired') : t('lots.expiryNone');
    const qualityOptions = (['PASSED', 'INSPECT', 'BLOCKED'] as LotQuality[]).map(q => ({ value: q, label: qualityLabel(q) }));
    const toInput = (row: LotRecord): SaveLotInput => ({
      materialCode: row.materialCode, lotNo: row.lotNo, mfgDate: day(row.mfgDate), expDate: day(row.expDate),
      supplierCode: row.supplierCode ?? '', qualityStatus: row.qualityStatus, note: row.note ?? '', isActive: row.isActive
    });
    return {
      functionCode: 'inv_lot_cat', api: lotsApi,
      keyOf: row => row.code, describe: row => `${row.materialCode} / ${row.lotNo}`,
      icon: <CalendarClock className="h-4 w-4" />,
      texts: {
        title: t('lots.title'), subtitle: t('lots.subtitle'), noun: t('lots.noun'),
        add: t('lots.add'), searchPlaceholder: t('lots.search'),
        addTitle: t('lots.addTitle'), editTitle: row => t('lots.editTitle', { code: `${row.materialCode} / ${row.lotNo}` }),
        fileName: 'DanhMucLo'
      },
      columns: [
        { key: 'lotNo', header: t('lots.lotNo'), width: '160px', sortable: true,
          render: row => <span className="font-mono font-bold">{row.lotNo}</span> },
        { key: 'materialCode', header: t('lots.material'), sortable: true,
          render: row => <span><span className="font-mono">{row.materialCode}</span>{row.materialName ? ` - ${row.materialName}` : ''}</span> },
        { key: 'mfgDate', header: t('lots.mfgDate'), width: '120px', sortable: true, render: row => row.mfgDate ? formatDate(row.mfgDate) : '—' },
        { key: 'expDate', header: t('lots.expDate'), width: '120px', sortable: true, render: row => row.expDate ? formatDate(row.expDate) : '—' },
        { key: 'expiry', header: t('lots.expiry'), align: 'center', width: '140px',
          render: row => <Badge variant={EXPIRY_VARIANT[row.expiryState]} size="sm">{expiryLabel(row.expiryState)}</Badge> },
        { key: 'supplierName', header: t('lots.supplier'), sortable: true, render: row => row.supplierName || row.supplierCode || '—' },
        { key: 'qualityStatus', header: t('lots.quality'), align: 'center', width: '140px', sortable: true,
          render: row => <Badge variant={QUALITY_VARIANT[row.qualityStatus]} size="sm">{qualityLabel(row.qualityStatus)}</Badge> },
        { key: 'isActive', header: t('lots.status'), align: 'center', width: '140px', sortable: true,
          render: row => row.isActive
            ? <Badge variant="success" size="sm">{t('lots.active')}</Badge>
            : <Badge variant="slate" size="sm">{t('lots.inactive')}</Badge> },
        ...recordStampColumns<LotRecord>(t)
      ],
      filters: [
        { key: 'materialCode', label: t('lots.material'), options: materialOptions },
        { key: 'quality', label: t('lots.quality'), options: qualityOptions },
        { key: 'expiry', label: t('lots.expiry'), options: [
          { value: 'near', label: t('lots.expiryNear') }, { value: 'expired', label: t('lots.expiryExpired') }
        ] }
      ] as CatalogFilter<LotRecord>[],
      excel: {
        columns: [
          { key: 'materialCode', header: t('lots.material'), required: true, width: 22, example: 'LAP-DELL-XPS15' },
          { key: 'lotNo', header: t('lots.lotNo'), required: true, width: 18, example: 'LOT-2610' },
          { key: 'mfgDate', header: t('lots.mfgDate'), width: 16, example: '2026-10-01' },
          { key: 'expDate', header: t('lots.expDate'), width: 16, example: '2028-10-01' },
          { key: 'supplierCode', header: t('lots.supplier'), width: 16, example: '' },
          { key: 'qualityStatus', header: t('lots.quality'), width: 16, example: 'PASSED' },
          { key: 'note', header: t('lots.note'), width: 40, example: '' },
          { key: 'isActive', header: t('lots.isActive'), type: 'boolean', width: 14, example: true }
        ],
        toRow: row => toInput(row)
      },
      emptyInput: { materialCode: '', lotNo: '', mfgDate: null, expDate: null, supplierCode: '', qualityStatus: 'PASSED', note: '', isActive: true },
      toInput,
      normalize: input => ({
        ...input, materialCode: input.materialCode.trim().toUpperCase(), lotNo: input.lotNo.trim().toUpperCase(),
        mfgDate: day(input.mfgDate), expDate: day(input.expDate), supplierCode: (input.supplierCode ?? '').trim().toUpperCase(),
        qualityStatus: ((input.qualityStatus || 'PASSED').toString().trim().toUpperCase()) as LotQuality, note: (input.note ?? '').trim()
      }),
      renderForm: ({ form, setForm, editing }) => (
        <>
          <div className="space-y-1">
            <CatalogLookup lookup="materials" params={{ tracking: 'lot' }} label={t('lots.material')} required disabled={!!editing}
              value={form.materialCode} onChange={code => setForm({ ...form, materialCode: code })}
              extraColumns={[{ key: 'uomCode', title: t('materials.uom') }]} />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{editing ? t('lots.keyHint') : t('lots.materialHint')}</p>
          </div>
          <TextInput label={t('lots.lotNo')} required autoFocus={!editing} disabled={!!editing} maxLength={30} value={form.lotNo}
            onChange={e => setForm({ ...form, lotNo: e.target.value.toUpperCase().replace(/\s/g, '') })} />
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
            <TextInput label={t('lots.mfgDate')} type="date" value={form.mfgDate ?? ''}
              onChange={e => setForm({ ...form, mfgDate: e.target.value || null })} />
            <TextInput label={t('lots.expDate')} type="date" value={form.expDate ?? ''} min={form.mfgDate ?? undefined}
              onChange={e => setForm({ ...form, expDate: e.target.value || null })} />
          </div>
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
            <CatalogLookup lookup="suppliers" label={t('lots.supplier')} value={form.supplierCode}
              onChange={code => setForm({ ...form, supplierCode: code })} />
            <SelectInput label={t('lots.quality')} value={form.qualityStatus} options={qualityOptions}
              onChange={e => setForm({ ...form, qualityStatus: e.target.value as LotQuality })} />
          </div>
          <TextArea label={t('lots.note')} rows={2} maxLength={300} value={form.note}
            onChange={e => setForm({ ...form, note: e.target.value })} />
          <Checkbox label={t('lots.isActive')} checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
        </>
      ),
      formWidth: 'xl'
    };
  }, [t, materialOptions]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
