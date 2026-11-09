// Shown on a block of settings that apply to the whole system (every company unit) to a user who may edit the screen but is not an
// administrator: the server only lets an administrator save those (the settings of one unit stay editable).
import React from 'react';
import { Lock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const GlobalSettingNote: React.FC<{ show: boolean }> = ({ show }) => {
  const { t } = useLanguage();
  if (!show) return null;
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
      <Lock className="h-3.5 w-3.5 shrink-0" />{t('globalSettings.adminOnly')}
    </p>
  );
};
