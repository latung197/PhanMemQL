// The password rules of the security policy (GET /api/auth/password-rules), listed under a new-password field.
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { securityApi, type PasswordRules } from '../../services/securityApi';

/** Loads the rules once; `onLoaded` gives them to the form (minimum length of the field). */
export const usePasswordRules = () => {
  const [rules, setRules] = useState<PasswordRules | null>(null);
  useEffect(() => {
    let alive = true;
    void securityApi.passwordRules().then(r => { if (alive) setRules(r); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return rules;
};

export const PasswordRulesHint: React.FC<{ rules: PasswordRules | null }> = ({ rules }) => {
  const { t } = useLanguage();
  if (!rules) return null;
  const items = [
    t('account.rules.minLength', { n: rules.minLength }),
    rules.requireLetter ? t('account.rules.letter') : null,
    rules.requireDigit ? t('account.rules.digit') : null,
    rules.requireUpper ? t('account.rules.upper') : null,
    rules.requireSpecial ? t('account.rules.special') : null,
    rules.history > 0 ? t('account.rules.history', { n: rules.history }) : null
  ].filter(Boolean);
  return (
    <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-slate-500 dark:text-slate-400">
      {items.map(item => <li key={item}>{item}</li>)}
    </ul>
  );
};
