import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, Lock, User, Eye, EyeOff, AlertCircle, Building2, Globe, PartyPopper, Info, ScrollText, Wrench
} from 'lucide-react';
import { UserProfile } from '../../types';
import { authService, LoginBranding, LoginNotice, LoginUnitOption } from '../../services/authService';
import { loginImageUrl } from '../../services/settingsApi';
import { BrandLogo } from '../../components/common/BrandLogo';
import { getErrorMessage } from '../../services/apiClient';
import { useLanguage } from '../../context/LanguageContext';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

// Only the username and the last unit are remembered; passwords are never stored in the browser.
const rememberedLoginKey = 's_erp_remembered_login';

const getRememberedLogin = (): { username: string; unitCode?: string } | null => {
  try {
    const saved = localStorage.getItem(rememberedLoginKey);
    if (!saved) return null;
    const parsed: unknown = JSON.parse(saved);
    if (typeof parsed === 'object' && parsed !== null && 'username' in parsed && typeof parsed.username === 'string') {
      const unitCode = 'unitCode' in parsed && typeof parsed.unitCode === 'string' ? parsed.unitCode : undefined;
      return { username: parsed.username, unitCode };
    }
  } catch {
    // Storage may be unavailable or contain invalid data.
  }
  return null;
};

// Look of each notice kind: icon + soft tint (left panel is dark brand, so the cards are translucent white).
const NOTICE_ICON = { WELCOME: PartyPopper, INFO: Info, RULE: ScrollText, MAINTENANCE: Wrench, BACKGROUND: Info } as const;
/** Seconds each notice stays in the small slot before the next one takes its place. */
const ROTATE_MS = 8000;

/** Chip with the kind of a notice (welcome, maintenance...). */
const KIND_LABEL_KEY = { WELCOME: 'auth.kind.WELCOME', INFO: 'auth.kind.INFO', RULE: 'auth.kind.RULE', MAINTENANCE: 'auth.kind.MAINTENANCE', BACKGROUND: 'auth.kind.INFO' } as const;

/** One notice. With a picture the picture is the card background under a dark veil; `big` is the pinned / first one. */
const NoticeCard: React.FC<{ notice: LoginNotice; panel: boolean; big: boolean }> = ({ notice: n, panel, big }) => {
  const { t } = useLanguage();
  const Icon = NOTICE_ICON[n.kind] ?? Info;
  const maintenance = n.kind === 'MAINTENANCE';
  const withImage = Boolean(n.imageCode);
  const onDark = withImage || panel;
  const surface = withImage
    ? 'border-white/25 text-white shadow-xl'
    : panel
      ? `backdrop-blur-sm text-white ${maintenance ? 'border-amber-300/60 bg-amber-300/15' : 'border-white/20 bg-white/10'}`
      : maintenance ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40'
        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';
  const chip = maintenance
    ? 'bg-amber-300 text-amber-950'
    : onDark ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-700 dark:bg-slate-800 dark:text-brand-200';
  return (
    <article className={`relative overflow-hidden rounded-2xl border ${surface} ${big ? 'min-h-[12rem] p-6' : 'min-h-[7rem] p-5'} flex flex-col justify-end`}
      style={withImage ? { backgroundImage: `url(${loginImageUrl(n.imageCode!)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      {withImage && <div className="absolute inset-0 bg-black/65" aria-hidden />}
      <div className={`relative space-y-2 min-w-0 ${withImage ? "[text-shadow:0_1px_3px_rgba(0,0,0,0.55)]" : ""}`}>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${chip}`}>
          <Icon className="h-3 w-3" />{t(KIND_LABEL_KEY[n.kind])}
        </span>
        <h3 className={`font-extrabold leading-snug ${big ? 'text-xl' : 'text-base'} ${onDark ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>{n.title}</h3>
        {n.content && (
          <p className={`whitespace-pre-line leading-relaxed ${big ? 'text-sm' : 'text-xs'} ${withImage ? 'text-white/90' : panel ? 'text-brand-50/90' : 'text-slate-600 dark:text-slate-300'}`}>{n.content}</p>
        )}
      </div>
    </article>
  );
};

/**
 * The notices of Settings › Thông báo trang đăng nhập, two at a time: the first one (pinned ones come first) keeps the big slot,
 * the others take turns in the small slot. `panel` = on the dark brand side, otherwise a compact list above the form.
 */
const NoticeSlots: React.FC<{ notices: LoginNotice[]; panel?: boolean }> = ({ notices, panel = false }) => {
  const posts = notices.filter(n => n.kind !== 'BACKGROUND');
  const featured = posts[0];
  const rest = posts.slice(1);
  const [turn, setTurn] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (rest.length < 2 || paused) return;
    const timer = window.setInterval(() => setTurn(x => x + 1), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [rest.length, paused]);

  if (!featured) return null;
  const current = rest.length > 0 ? rest[turn % rest.length] : null;
  return (
    <div className="space-y-3" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <NoticeCard key={featured.code} notice={featured} panel={panel} big />
      {current && <NoticeCard key={current.code} notice={current} panel={panel} big={false} />}
      {rest.length > 1 && (
        <div className="flex justify-center gap-1.5" aria-hidden>
          {rest.map((n, i) => (
            <span key={n.code} className={`h-1.5 rounded-full transition-all ${i === turn % rest.length ? 'w-5' : 'w-1.5'} ${panel ? 'bg-white/70' : 'bg-brand-400'} ${i === turn % rest.length ? '' : 'opacity-40'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [rememberedLogin] = useState(getRememberedLogin);
  const { language, setLanguage, languages, t } = useLanguage();
  const [username, setUsername] = useState(rememberedLogin?.username || '');
  const [password, setPassword] = useState('');
  const [rememberUsername, setRememberUsername] = useState(Boolean(rememberedLogin));
  const [companyUnits, setCompanyUnits] = useState<LoginUnitOption[]>([]);
  const [selectedUnitCode, setSelectedUnitCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notices, setNotices] = useState<LoginNotice[]>([]);
  // Name, slogan and footer of the company profile; an empty text falls back to the built-in one.
  const [branding, setBranding] = useState<LoginBranding | null>(null);
  useEffect(() => {
    let cancelled = false;
    authService.getLoginBranding().then(b => { if (!cancelled) setBranding(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  // The picture of the first BACKGROUND notice in force (the server returns only those) is the background of the left side.
  const backgroundCode = notices.find(n => n.kind === 'BACKGROUND' && n.imageCode)?.imageCode ?? '';
  const brandSlogan = branding?.slogan || t('auth.subtitle');
  const brandFooter = branding?.footer || t('auth.footer');

  // The notices come in the visitor's language, so they are read again when it changes. A failure just hides them.
  useEffect(() => {
    let cancelled = false;
    authService.getLoginNotices().then(items => { if (!cancelled) setNotices(items); }).catch(() => { if (!cancelled) setNotices([]); });
    return () => { cancelled = true; };
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    authService.getLoginUnits()
      .then(units => {
        if (cancelled) return;
        setCompanyUnits(units);
        const preferred = units.find(u => u.code === rememberedLogin?.unitCode)
          || units.find(u => u.isDefault) || units[0];
        setSelectedUnitCode(preferred?.code || '');
      })
      .catch(error => !cancelled && setErrorMsg(getErrorMessage(error)));
    return () => { cancelled = true; };
  }, [rememberedLogin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitCode) {
      setErrorMsg(t('auth.selectUnit'));
      return;
    }
    setErrorMsg('');
    setIsLoading(true);
    try {
      let user = await authService.login(username.trim(), password, selectedUnitCode);
      // A language picked on this screen becomes the user's own choice.
      if (language !== user.language) {
        try { user = await authService.setMyLanguage(language); } catch { /* keep the profile language */ }
      }
      try {
        if (rememberUsername) {
          localStorage.setItem(rememberedLoginKey, JSON.stringify({ username: username.trim(), unitCode: selectedUnitCode }));
        } else {
          localStorage.removeItem(rememberedLoginKey);
        }
      } catch {
        // Login should continue even if browser storage is unavailable.
      }
      onLoginSuccess(user);
    } catch (error) {
      setErrorMsg(getErrorMessage(error));
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans">

      {/* Left side (wide screens): company name and the notices set in Settings */}
      <aside className="relative hidden lg:flex lg:w-[56%] xl:w-[60%] flex-col justify-between overflow-hidden bg-brand-700 dark:bg-slate-950 text-white p-10 xl:px-16 xl:py-14"
        style={backgroundCode ? { backgroundImage: `url(${loginImageUrl(backgroundCode)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        {/* A background picture gets a veil so the white text stays readable */}
        {backgroundCode && <div className="absolute inset-0 bg-brand-900/65" aria-hidden />}
        <BrandLogo onDark className="relative" />
        {/* Long notices scroll inside this area; the name above and the footer below stay in place */}
        <div className="relative -ml-10 xl:-ml-16 min-h-0 flex-1 overflow-y-auto py-6 [direction:rtl] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.45)_transparent]">
          <div className="flex min-h-full w-full flex-col justify-center space-y-6 pl-8 xl:pl-14 [direction:ltr]">
            <NoticeSlots notices={notices} panel />
          </div>
        </div>
        <p className="relative pt-4 text-[11px] text-brand-100/80">{brandFooter}</p>
      </aside>

      {/* Right side: the login form */}
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-4 relative overflow-x-hidden overflow-y-auto">
      
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 h-96 w-96 bg-indigo-600/10 dark:bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 h-96 w-96 bg-purple-600/10 dark:bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

      {notices.length > 0 && (
        <div className="lg:hidden w-full max-w-lg relative z-10 max-h-[45vh] overflow-y-auto"><NoticeSlots notices={notices} /></div>
      )}

      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-5">
        
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <BrandLogo size="lg" className="mb-1" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {brandSlogan}
          </p>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-200 p-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Username and password login */}
        <form onSubmit={handleLogin} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('auth.username')}</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('auth.usernamePlaceholder')}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden transition-colors font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 focus:border-indigo-500 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden transition-colors font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('auth.unit')}</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3 h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                <select
                  value={selectedUnitCode}
                  onChange={(e) => setSelectedUnitCode(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-hidden transition-colors font-medium cursor-pointer"
                >
                  {companyUnits.length === 0 && <option value="">{t('auth.loadingUnits')}</option>}
                  {companyUnits.map(unit => (
                    <option key={unit.id} value={unit.code}>
                      {unit.code} - {unit.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberUsername}
                onChange={(e) => setRememberUsername(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer"
              />
              {t('auth.rememberUsername')}
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer focus:outline-hidden flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  {t('auth.login')}
                </>
              )}
            </button>
        </form>

        {/* Footer info */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-3 text-center text-[10px] text-slate-500 space-y-1">
          {languages.length > 1 && (
            <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <Globe className="h-3.5 w-3.5 text-indigo-500" />
              <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Ngôn ngữ / Language"  // i18n-ignore
                className="bg-transparent outline-hidden cursor-pointer">
                {languages.map(l => <option key={l.code} value={l.code}>{l.nativeName}</option>)}
              </select>
            </label>
          )}
          <p>{brandFooter}</p>
        </div>

      </div>
      </main>
    </div>
  );
};
