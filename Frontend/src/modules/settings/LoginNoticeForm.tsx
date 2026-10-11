// Form of the login notices in tabs (content, English text, display), as the material catalog does for many fields.
// A component of its own because it keeps the active tab and uploads the picture.
import React, { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Checkbox } from '../../components/common/Checkbox';
import { SelectInput, TextArea, TextInput } from '../../components/common/FormField';
import { Tabs } from '../../components/common/Tabs';
import { useLanguage } from '../../context/LanguageContext';
import { getErrorMessage } from '../../services/apiClient';
import { loginImageUrl, loginNoticeImagesApi, type LoginNoticeKind, type LoginNoticeRow, type SaveLoginNoticeInput } from '../../services/settingsApi';
import { showToast } from '../../utils/toast';

type TabKey = 'content' | 'english' | 'display';

/** Picks a picture, shrinks it in the browser, uploads it and keeps its code in the form. */
const ImageField: React.FC<{ code: string; onChange: (code: string) => void; required?: boolean }> = ({ code, onChange, required }) => {
  const { t } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await loginNoticeImagesApi.upload(file));
    } catch (error) {
      showToast.error(error instanceof Error && ['type', 'image', 'canvas', 'size', 'read'].includes(error.message)
        ? t('loginNotices.imageFailed') : getErrorMessage(error));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
        {t('loginNotices.image')}{required && <span className="text-rose-500"> *</span>}
      </p>
      <div className="flex items-start gap-3">
        <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          {code
            ? <img src={loginImageUrl(code)} alt="" className="h-full w-full object-cover" />
            : <ImagePlus className="h-6 w-6 text-slate-400" />}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => input.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-[5px] border border-brand-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-brand-300 cursor-pointer">
              <ImagePlus className="h-3.5 w-3.5" />{busy ? t('loginNotices.imageUploading') : code ? t('loginNotices.imageChange') : t('loginNotices.imageChoose')}
            </button>
            {code && (
              <button type="button" disabled={busy} onClick={() => onChange('')}
                className="inline-flex items-center gap-1.5 rounded-[5px] border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />{t('loginNotices.imageRemove')}
              </button>
            )}
          </div>
          <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{t('loginNotices.imageHint')}</p>
        </div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => void pick(e.target.files?.[0])} />
    </div>
  );
};

export const LoginNoticeForm: React.FC<{
  form: SaveLoginNoticeInput;
  setForm: (next: SaveLoginNoticeInput) => void;
  editing?: LoginNoticeRow;
  kindOptions: { value: string; label: string }[];
}> = ({ form, setForm, editing, kindOptions }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<TabKey>('content');
  const set = (patch: Partial<SaveLoginNoticeInput>) => setForm({ ...form, ...patch });
  // A background notice is only a picture: no text, no pinning.
  const background = form.kind === 'BACKGROUND';

  return (
    <div className="space-y-3">
      <Tabs<TabKey> value={tab} onChange={setTab} items={[
        { key: 'content', label: t('loginNotices.tabContent') },
        ...(background ? [] : [{ key: 'english' as TabKey, label: t('loginNotices.tabEnglish') }]),
        { key: 'display', label: t('loginNotices.tabDisplay') }
      ]} />

      <div className="min-h-[21rem] space-y-3">
        {tab === 'content' && (
          <>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
              <TextInput label={t('loginNotices.code')} required autoFocus={!editing} disabled={!!editing} maxLength={30}
                className="font-mono uppercase" value={form.code} hint={t('loginNotices.codeHint')}
                onChange={e => set({ code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
              <SelectInput label={t('loginNotices.kindField')} required value={form.kind} options={kindOptions}
                onChange={e => {
                  const kind = e.target.value as LoginNoticeKind;
                  set(kind === 'BACKGROUND' ? { kind, pinned: false } : { kind });
                }} />
            </div>
            <TextInput label={t('loginNotices.titleField')} required autoFocus={!!editing} maxLength={200} value={form.title}
              hint={background ? t('loginNotices.backgroundHint') : undefined} onChange={e => set({ title: e.target.value })} />
            {!background && (
              <TextArea label={t('loginNotices.content')} rows={4} maxLength={2000} value={form.content}
                onChange={e => set({ content: e.target.value })} />
            )}
            <ImageField code={form.loginImageCode} required={background} onChange={loginImageCode => set({ loginImageCode })} />
          </>
        )}

        {tab === 'english' && !background && (
          <>
            <p className="rounded-[5px] bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              {t('loginNotices.englishHint')}
            </p>
            <TextInput label={t('loginNotices.titleEn')} maxLength={200} value={form.titleEn}
              onChange={e => set({ titleEn: e.target.value })} />
            <TextArea label={t('loginNotices.contentEn')} rows={5} maxLength={2000} value={form.contentEn}
              onChange={e => set({ contentEn: e.target.value })} />
          </>
        )}

        {tab === 'display' && (
          <>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
              <TextInput label={t('loginNotices.startDate')} type="date" value={form.startDate ?? ''}
                onChange={e => set({ startDate: e.target.value || null })} />
              <TextInput label={t('loginNotices.endDate')} type="date" value={form.endDate ?? ''} min={form.startDate ?? undefined}
                onChange={e => set({ endDate: e.target.value || null })} />
              <TextInput label={t('loginNotices.sortOrder')} type="number" className="text-right font-mono" value={form.sortOrder}
                onChange={e => set({ sortOrder: Number(e.target.value) || 0 })} />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('loginNotices.dateHint')}</p>
            {!background && (
              <Checkbox label={t('loginNotices.pinned')} subLabel={t('loginNotices.pinnedHint')} checked={form.pinned}
                onChange={pinned => set({ pinned })} />
            )}
            <Checkbox label={t('loginNotices.isActive')} checked={form.isActive} onChange={isActive => set({ isActive })} />
          </>
        )}
      </div>
    </div>
  );
};
