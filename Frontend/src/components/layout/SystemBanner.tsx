// The strip under the header with the system notices of Settings › Thanh thông báo hệ thống (maintenance, deadlines, incidents).
// A text longer than the strip scrolls slowly (stops under the mouse; not at all when the user asks for less motion). The user can
// close a notice. An INFO one stays closed for that user (kept in the browser under the user's name) until the notice is edited;
// a WARNING one is hidden only for the current session (it comes back at the next sign-in); an URGENT one cannot be closed.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertOctagon, AlertTriangle, Info, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { activeBannersApi, type ActiveBanner, type BannerLevel } from '../../services/settingsApi';
import { formatDateTime } from '../../utils/format';

/** Dispatched on window when the server says the notices changed (stream event "settings"). */
export const BANNERS_CHANGED_EVENT = 'erp:banners-changed';

const POLL_MS = 60_000;
/** Closed INFO notices, per user: { code: version }. Survives sign-out. */
const dismissedKey = (user: string) => `s_erp_banner_dismissed:${user}`;
/** Hidden WARNING notices, per user: { code: version }. Dropped at sign-out (clearHiddenBanners) or when the tab is closed. */
const HIDDEN_PREFIX = 's_erp_banner_hidden:';
const hiddenKey = (user: string) => `${HIDDEN_PREFIX}${user}`;

const LOOK: Record<BannerLevel, { bar: string; button: string; Icon: React.ElementType }> = {
  INFO: { bar: 'bg-brand-100 text-brand-900 border-brand-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700', button: 'hover:bg-brand-200 dark:hover:bg-slate-700', Icon: Info },
  WARNING: { bar: 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/60 dark:text-amber-100 dark:border-amber-800', button: 'hover:bg-amber-200 dark:hover:bg-amber-900', Icon: AlertTriangle },
  URGENT: { bar: 'bg-rose-600 text-white border-rose-700', button: 'hover:bg-rose-700', Icon: AlertOctagon }
};

const readMap = (storage: Storage | undefined, key: string): Record<string, number> => {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(key) ?? '{}');
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, number> : {};
  } catch {
    return {};
  }
};
const writeMap = (storage: Storage | undefined, key: string, value: Record<string, number>) => {
  try { storage?.setItem(key, JSON.stringify(value)); } catch { /* private mode: it just comes back next time */ }
};
const safe = (get: () => Storage): Storage | undefined => { try { return get(); } catch { return undefined; } };

/** Called at sign-out: the warnings a user hid come back at the next sign-in (a page reload keeps them hidden). */
export const clearHiddenBanners = (): void => {
  const storage = safe(() => sessionStorage);
  if (!storage) return;
  Object.keys(storage).filter(k => k.startsWith(HIDDEN_PREFIX)).forEach(k => storage.removeItem(k));
};

/** One strip. Also used as the preview in the notice form (no close button when `onClose` is missing). */
export const BannerBar: React.FC<{ level: BannerLevel; message: string; endAt?: string | null; onClose?: () => void }> = ({ level, message, endAt, onClose }) => {
  const { t } = useLanguage();
  const look = LOOK[level] ?? LOOK.INFO;
  const box = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  // Scroll only when the text does not fit; the speed follows its length (about 7 characters a second).
  useLayoutEffect(() => {
    const measure = () => setOverflow(Boolean(box.current && ghost.current && ghost.current.offsetWidth > box.current.clientWidth + 1));
    measure();
    const observer = new ResizeObserver(measure);
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, [message]);

  const Icon = look.Icon;
  return (
    <div role={level === 'URGENT' ? 'alert' : 'status'} className={`flex items-center gap-2.5 border-b px-3 sm:px-5 py-1.5 text-xs sm:text-[13px] font-semibold ${look.bar}`}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <div ref={box} className="relative min-w-0 flex-1 overflow-hidden" title={message}>
        {/* Invisible copy to measure the text; the shown one may carry the scrolling padding */}
        <span ref={ghost} aria-hidden className="invisible absolute left-0 top-0 whitespace-nowrap">{message}</span>
        <span className={`inline-block whitespace-nowrap ${overflow ? 'banner-marquee hover:[animation-play-state:paused]' : 'max-w-full truncate'}`}
          style={overflow ? { ['--banner-duration' as string]: `${Math.max(14, Math.round(message.length / 7) + 8)}s` } : undefined}>
          {message}
        </span>
      </div>
      {endAt && <span className="hidden shrink-0 text-[11px] font-medium opacity-80 md:inline">{t('banner.until', { time: formatDateTime(endAt) })}</span>}
      {onClose && level !== 'URGENT' && (
        <button type="button" onClick={onClose} aria-label={t('banner.close')} title={t('banner.close')}
          className={`shrink-0 rounded-[5px] p-1 transition-colors cursor-pointer focus:outline-hidden ${look.button}`}>
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

/**
 * Reads the notices in force for the working unit and shows them; `unitCode` changes when the user switches unit, `user` is the
 * signed-in user name (what "closed" is remembered under).
 */
export const SystemBanner: React.FC<{ unitCode?: string; user: string }> = ({ unitCode, user }) => {
  const { t, language } = useLanguage();
  const [banners, setBanners] = useState<ActiveBanner[]>([]);
  const [closed, setClosed] = useState<Record<string, number>>(() => readMap(safe(() => localStorage), dismissedKey(user)));
  const [hidden, setHidden] = useState<Record<string, number>>(() => readMap(safe(() => sessionStorage), hiddenKey(user)));

  const load = useCallback(() => {
    activeBannersApi.list().then(setBanners).catch(() => { /* the strip is optional: keep what is shown */ });
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    window.addEventListener(BANNERS_CHANGED_EVENT, load);
    return () => { window.clearInterval(timer); window.removeEventListener(BANNERS_CHANGED_EVENT, load); };
  }, [load, unitCode, language]);

  const close = (banner: ActiveBanner) => {
    if (banner.level === 'WARNING') {
      const next = { ...hidden, [banner.code]: banner.version };
      setHidden(next);
      writeMap(safe(() => sessionStorage), hiddenKey(user), next);
    } else {
      const next = { ...closed, [banner.code]: banner.version };
      setClosed(next);
      writeMap(safe(() => localStorage), dismissedKey(user), next);
    }
  };

  const isClosed = (b: ActiveBanner) => b.level !== 'URGENT' && (b.level === 'WARNING' ? hidden[b.code] : closed[b.code]) === b.version;
  const shown = banners.filter(b => !isClosed(b));
  const closedCount = banners.length - shown.length;

  /** Brings every closed notice back. */
  const showAgain = () => {
    setClosed({});
    setHidden({});
    safe(() => localStorage)?.removeItem(dismissedKey(user));
    safe(() => sessionStorage)?.removeItem(hiddenKey(user));
  };

  if (banners.length === 0) return null;
  return (
    <div className="shrink-0">
      {shown.map(b => <BannerBar key={b.code} level={b.level} message={b.message} endAt={b.endAt} onClose={() => close(b)} />)}
      {closedCount > 0 && (
        <div className="flex justify-end border-b border-slate-200 bg-slate-50 px-3 sm:px-5 py-0.5 dark:border-slate-800 dark:bg-slate-900">
          <button type="button" onClick={showAgain}
            className="text-[11px] font-semibold text-brand-700 hover:underline dark:text-brand-300 cursor-pointer focus:outline-hidden">
            {t('banner.closedCount', { count: closedCount })}
          </button>
        </div>
      )}
    </div>
  );
};
