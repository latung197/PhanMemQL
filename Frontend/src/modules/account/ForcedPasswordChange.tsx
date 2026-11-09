// Shown instead of the application while the token only allows changing the password (set by someone else, or too old): the server
// refuses every other call until then. Changing it gives a normal token and the session starts.
import React from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useLanguage } from '../../context/LanguageContext';
import type { UserProfile } from '../../types';
import { PasswordForm } from './MyAccountModal';

export const ForcedPasswordChange: React.FC<{ user: UserProfile; onChanged: (user: UserProfile) => void; onLogout: () => void }> = ({ user, onChanged, onLogout }) => {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4 rounded-[9px] border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('account.forced.title')}</h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('account.forced.message', { name: user.fullName })}</p>
          </div>
        </div>
        <PasswordForm onChanged={onChanged} />
        <div className="flex justify-start border-t border-slate-100 pt-3 dark:border-slate-800">
          <Button type="button" variant="ghost" size="sm" icon={<LogOut className="h-3.5 w-3.5" />} onClick={onLogout}>{t('account.forced.logout')}</Button>
        </div>
      </div>
    </div>
  );
};
