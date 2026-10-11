// Form of the system notices: the strip as it will look is always on top and follows what is typed; below it two tabs
// (content, schedule). A component of its own because it keeps the active tab.
import React, { useState } from 'react';
import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import { Checkbox } from '../../components/common/Checkbox';
import { TextArea, TextInput } from '../../components/common/FormField';
import { Tabs } from '../../components/common/Tabs';
import { CatalogMultiLookup } from '../../components/catalog/CatalogLookup';
import { BannerBar } from '../../components/layout/SystemBanner';
import { useLanguage } from '../../context/LanguageContext';
import type { BannerLevel, BannerRow, SaveBannerInput } from '../../services/settingsApi';

type TabKey = 'content' | 'schedule';

const splitCodes = (text: string): string[] => text.split(/[\s,;]+/).map(code => code.trim().toUpperCase()).filter(Boolean);
/** The backend keeps UTC instants; the form edits local time ("2026-10-12T22:00"). */
const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const fromLocalInput = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const LEVELS: { level: BannerLevel; Icon: React.ElementType; ring: string; dot: string }[] = [
  { level: 'INFO', Icon: Info, ring: 'border-brand-500 bg-brand-50 dark:bg-slate-800', dot: 'text-brand-600' },
  { level: 'WARNING', Icon: AlertTriangle, ring: 'border-amber-500 bg-amber-50 dark:bg-amber-950/40', dot: 'text-amber-600' },
  { level: 'URGENT', Icon: AlertOctagon, ring: 'border-rose-500 bg-rose-50 dark:bg-rose-950/40', dot: 'text-rose-600' }
];

/** "End today" = 23:59 local time today. */
const endOfToday = (): string => {
  const date = new Date();
  date.setHours(23, 59, 0, 0);
  return date.toISOString();
};
const inHours = (hours: number): string => new Date(Date.now() + hours * 3_600_000).toISOString();

export const BannerForm: React.FC<{
  form: SaveBannerInput;
  setForm: (next: SaveBannerInput) => void;
  editing?: BannerRow;
}> = ({ form, setForm, editing }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<TabKey>('content');
  const set = (patch: Partial<SaveBannerInput>) => setForm({ ...form, ...patch });
  const quickEnds: { label: string; value: string | null }[] = [
    { label: t('banners.endToday'), value: endOfToday() },
    { label: t('banners.endIn2h'), value: inHours(2) },
    { label: t('banners.endIn1d'), value: inHours(24) },
    { label: t('banners.endIn7d'), value: inHours(24 * 7) },
    { label: t('banners.endNever'), value: null }
  ];

  return (
    <div className="space-y-3">
      {/* The strip as users will see it */}
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('banners.preview')}</p>
        <div className="overflow-hidden rounded-[7px] border border-slate-200 dark:border-slate-700">
          <BannerBar level={form.level} message={form.message.trim() || t('banners.previewEmpty')} endAt={form.endAt} />
        </div>
      </div>

      <Tabs<TabKey> value={tab} onChange={setTab} items={[
        { key: 'content', label: t('banners.tabContent') },
        { key: 'schedule', label: t('banners.tabSchedule') }
      ]} />

      <div className="min-h-[19rem] space-y-3">
        {tab === 'content' && (
          <>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('banners.levelField')} <span className="text-rose-500">*</span></p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('banners.levelField')}>
                {LEVELS.map(({ level, Icon, ring, dot }) => {
                  const selected = form.level === level;
                  return (
                    <button key={level} type="button" role="radio" aria-checked={selected} onClick={() => set({ level })}
                      className={`flex items-start gap-2 rounded-[7px] border p-2.5 text-left transition-colors cursor-pointer focus:outline-hidden ${
                        selected ? ring : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'}`}>
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${dot}`} />
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">{t(`banners.level.${level}`)}</span>
                        <span className="block text-[11px] leading-snug text-slate-500 dark:text-slate-400">{t(`banners.levelDesc.${level}`)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <TextInput label={t('banners.code')} required autoFocus={!editing} disabled={!!editing} maxLength={30}
              className="font-mono uppercase" value={form.code} hint={t('banners.codeHint')}
              onChange={e => set({ code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
            <TextArea label={t('banners.message')} required autoFocus={!!editing} rows={3} maxLength={500} value={form.message}
              hint={`${form.message.length}/500`} onChange={e => set({ message: e.target.value })} />
            <TextArea label={t('banners.messageEn')} rows={2} maxLength={500} value={form.messageEn}
              hint={t('banners.messageEnHint')} onChange={e => set({ messageEn: e.target.value })} />
          </>
        )}

        {tab === 'schedule' && (
          <>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
              <TextInput label={t('banners.startAt')} type="datetime-local" value={toLocalInput(form.startAt)}
                onChange={e => set({ startAt: fromLocalInput(e.target.value) })} />
              <TextInput label={t('banners.endAt')} type="datetime-local" value={toLocalInput(form.endAt)} min={toLocalInput(form.startAt) || undefined}
                onChange={e => set({ endAt: fromLocalInput(e.target.value) })} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t('banners.quickEnd')}</span>
              {quickEnds.map(q => (
                <button key={q.label} type="button" onClick={() => set({ endAt: q.value })}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer">
                  {q.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('banners.timeHint')}</p>

            <div className="space-y-1">
              <CatalogMultiLookup lookup="companyUnits" label={t('banners.units')} value={splitCodes(form.unitCodes)}
                onChange={codes => set({ unitCodes: codes.join(',') })} />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('banners.unitsHint')}</p>
            </div>

            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
              <TextInput label={t('banners.sortOrder')} type="number" className="text-right font-mono" value={form.sortOrder}
                onChange={e => set({ sortOrder: Number(e.target.value) || 0 })} />
              <Checkbox label={t('banners.isActive')} checked={form.isActive} onChange={isActive => set({ isActive })} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
