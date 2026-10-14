// Form of the material catalog in tabs (as the old screen had): basic information, units / lots / tracking flags,
// warehouse norms and tax, dimensions. A component of its own because it keeps the active tab.
import React, { useState } from 'react';
import { Checkbox } from '../../../../components/common/Checkbox';
import { SelectInput, TextArea, TextInput } from '../../../../components/common/FormField';
import { Tabs } from '../../../../components/common/Tabs';
import { CatalogLookup } from '../../../../components/catalog/CatalogLookup';
import { Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '../../../../context/LanguageContext';
import type { MaterialRecord, SaveMaterialInput } from './types';

type TabKey = 'basic' | 'tracking' | 'norms' | 'dims' | 'uoms';
type NumberKey = 'minStock' | 'maxStock' | 'length' | 'width' | 'height' | 'weight' | 'volume';

export const MaterialForm: React.FC<{
  form: SaveMaterialInput;
  setForm: (next: SaveMaterialInput) => void;
  editing?: MaterialRecord;
}> = ({ form, setForm, editing }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<TabKey>('basic');
  const conversions = form.conversions ?? [];
  const setConversion = (index: number, patch: Partial<NonNullable<SaveMaterialInput['conversions']>[number]>) =>
    set({ conversions: conversions.map((c, i) => i === index ? { ...c, ...patch } : c) });
  const set = (patch: Partial<SaveMaterialInput>) => setForm({ ...form, ...patch });

  // Turning a flag off also clears what depends on it, so the form never holds an impossible combination.
  const setStock = (isStockItem: boolean) => set(isStockItem ? { isStockItem }
    : { isStockItem, trackLot: false, hasExpiry: false, shelfLifeDays: null, trackLocation: false, isCycleCounted: false });
  const setLot = (trackLot: boolean) => set(trackLot ? { trackLot } : { trackLot, hasExpiry: false, shelfLifeDays: null });
  const setExpiry = (hasExpiry: boolean) => set(hasExpiry ? { hasExpiry, trackLot: true } : { hasExpiry, shelfLifeDays: null });

  const number = (key: NumberKey, label: string) => (
    <TextInput label={label} type="number" min={0} step="any" className="text-right font-mono"
      value={form[key] ?? ''} onChange={e => set({ [key]: e.target.value === '' ? null : Number(e.target.value) })} />
  );

  return (
    <div className="space-y-3">
      <Tabs<TabKey> value={tab} onChange={setTab} items={[
        { key: 'basic', label: t('materials.tabBasic') },
        { key: 'tracking', label: t('materials.tabTracking') },
        { key: 'norms', label: t('materials.tabNorms') },
        { key: 'dims', label: t('materials.tabDims') },
        { key: 'uoms', label: t('materials.tabUoms') }
      ]} />

      {/* The panels share a minimum height so the window does not jump between tabs. */}
      <div className="min-h-[19rem] space-y-3">
        {tab === 'basic' && (
          <>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <TextInput label={t('materials.code')} required autoFocus={!editing} disabled={!!editing} maxLength={50}
                value={form.code} hint={t('materials.codeHint')}
                onChange={e => set({ code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
              <TextInput label={t('materials.name')} required autoFocus={!!editing} maxLength={200}
                value={form.name} onChange={e => set({ name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
              <TextInput label={t('materials.customerCode')} maxLength={50} value={form.customerMaterialCode}
                onChange={e => set({ customerMaterialCode: e.target.value })} />
              <TextInput label={t('materials.partNo')} maxLength={50} value={form.partNo}
                onChange={e => set({ partNo: e.target.value })} />
              <CatalogLookup lookup="materialTypes" label={t('materials.type')} value={form.materialTypeCode}
                onChange={code => set({ materialTypeCode: code })} />
              <CatalogLookup lookup="materialGroups" label={t('materials.group')} value={form.materialGroupCode}
                onChange={code => set({ materialGroupCode: code })} />
            </div>
            <TextArea label={t('materials.note')} rows={2} maxLength={500} value={form.note}
              onChange={e => set({ note: e.target.value })} />
            <Checkbox label={t('materials.isActive')} checked={form.isActive} onChange={isActive => set({ isActive })} />
          </>
        )}

        {tab === 'tracking' && (
          <>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <CatalogLookup lookup="uoms" label={t('materials.uom')} required value={form.uomCode}
                  onChange={code => set({ uomCode: code })} />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('materials.uomHint')}</p>
              </div>
              <SelectInput label={t('materials.costing')} value={form.costingMethod}
                options={[{ value: 'AVERAGE', label: t('materials.costingAverage') }, { value: 'FIFO', label: t('materials.costingFifo') }]}
                onChange={e => set({ costingMethod: e.target.value as SaveMaterialInput['costingMethod'] })} />
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              <Checkbox label={t('materials.isStockItem')} subLabel={t('materials.isStockItemHint')} checked={form.isStockItem}
                onChange={setStock} />
              <Checkbox label={t('materials.isCycleCounted')} checked={form.isCycleCounted} disabled={!form.isStockItem}
                onChange={isCycleCounted => set({ isCycleCounted })} />
              <Checkbox label={t('materials.trackLot')} checked={form.trackLot} disabled={!form.isStockItem} onChange={setLot} />
              <Checkbox label={t('materials.trackLocation')} checked={form.trackLocation} disabled={!form.isStockItem}
                onChange={trackLocation => set({ trackLocation })} />
              <Checkbox label={t('materials.hasExpiry')} subLabel={t('materials.hasExpiryHint')} checked={form.hasExpiry}
                disabled={!form.isStockItem} onChange={setExpiry} />
              {form.hasExpiry && (
                <TextInput label={t('materials.shelfLifeDays')} type="number" min={1} step={1} className="text-right font-mono"
                  value={form.shelfLifeDays ?? ''} onChange={e => set({ shelfLifeDays: e.target.value === '' ? null : Number(e.target.value) })} />
              )}
            </div>
          </>
        )}

        {tab === 'norms' && (
          <>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
              <CatalogLookup lookup="taxRates" label={t('materials.vatTax')} value={form.vatTaxRateCode}
                onChange={code => set({ vatTaxRateCode: code })} />
              <CatalogLookup lookup="taxRates" label={t('materials.importTax')} value={form.importTaxRateCode}
                onChange={code => set({ importTaxRateCode: code })} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {number('minStock', t('materials.minStock'))}
              {number('maxStock', t('materials.maxStock'))}
            </div>
          </>
        )}

        {tab === 'uoms' && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('materials.uomsHint', { uom: form.uomCode || '…' })}</p>
            {!form.uomCode && <p className="text-xs font-semibold text-amber-600">{t('materials.uomsNoBase')}</p>}
            {editing && form.uomCode !== editing.uomCode && conversions.length > 0 && (
              <p className="text-xs font-semibold text-amber-600">{t('materials.uomsBaseChanged')}</p>
            )}
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="p-2 text-left w-[28%]">{t('materials.uomColumn')}</th>
                    <th className="p-2 text-right w-[26%]">{t('materials.factorColumn')} ({form.uomCode || '…'})</th>
                    <th className="p-2 text-left">{t('materials.noteColumn')}</th>
                    <th className="p-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {conversions.map((row, index) => (
                    <tr key={index} className="border-t border-slate-200 dark:border-slate-700 align-top">
                      <td className="p-1.5"><CatalogLookup lookup="uoms" value={row.uomCode} onChange={code => setConversion(index, { uomCode: code })} /></td>
                      <td className="p-1.5"><TextInput type="number" min={0} step="any" className="text-right font-mono" value={row.factor || ''}
                        onChange={e => setConversion(index, { factor: e.target.value === '' ? 0 : Number(e.target.value) })} /></td>
                      <td className="p-1.5"><TextInput maxLength={300} value={row.note} onChange={e => setConversion(index, { note: e.target.value })} /></td>
                      <td className="p-1.5 text-center">
                        <button type="button" title={t('materials.removeUom')} onClick={() => set({ conversions: conversions.filter((_, i) => i !== index) })}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {conversions.length === 0 && (
                    <tr><td colSpan={4} className="p-4 text-center text-slate-500">{t('materials.noUoms')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <button type="button" disabled={!form.uomCode}
              onClick={() => set({ conversions: [...conversions, { uomCode: '', factor: 0, note: '', isActive: true }] })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 disabled:opacity-50 cursor-pointer">
              <Plus className="h-3.5 w-3.5" />{t('materials.addUom')}
            </button>
          </div>
        )}

        {tab === 'dims' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {number('length', t('materials.length'))}
            {number('width', t('materials.width'))}
            {number('height', t('materials.height'))}
            {number('weight', t('materials.weight'))}
            {number('volume', t('materials.volume'))}
          </div>
        )}
      </div>
    </div>
  );
};
