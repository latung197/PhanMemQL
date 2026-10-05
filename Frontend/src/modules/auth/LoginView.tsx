import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, Lock, User, Eye, EyeOff, AlertCircle, Building2, Globe
} from 'lucide-react';
import { UserProfile } from '../../types';
import { authService, LoginUnitOption } from '../../services/authService';
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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 h-96 w-96 bg-indigo-600/10 dark:bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 h-96 w-96 bg-purple-600/10 dark:bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-5">
        
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex h-14 w-14 bg-indigo-600 text-white rounded-2xl items-center justify-center font-extrabold text-2xl tracking-wider shadow-lg shadow-indigo-500/20 mb-1">
            S
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            FSTV Viêt Nam
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('auth.subtitle')}
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
          <p>{t('auth.footer')}</p>
        </div>

      </div>
    </div>
  );
};
