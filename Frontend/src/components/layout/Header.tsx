import React, { useState } from 'react';
import { 
  Sun, 
  Moon, 
  User, 
  LogOut, 
  Settings, 
  Menu, 
  ChevronDown, 
  ShieldCheck,
  Globe,
  Building2,
  RotateCcw,
  KeyRound,
  UserRound
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { NotificationDropdown } from './NotificationDropdown';
import { PublishNotificationModal } from './PublishNotificationModal';
import { useConfirm } from '../common/ConfirmDialog';
import { MyAccountModal, MyAccountTab } from '../../modules/account/MyAccountModal';
import { SystemNotification, UserProfile, CompanyUnit } from '../../types';
import { hasRight, RIGHTS } from '../../utils/permissions';
import { authService } from '../../services/authService';
import { getErrorMessage } from '../../services/apiClient';
import { showToast } from '../../utils/toast';

// Shared look of the toolbar controls: same height, white chip on the brand header.
const PILL = 'relative flex h-9 items-center gap-1.5 px-2 rounded-[7px] bg-white dark:bg-slate-900 border border-brand-300/60 dark:border-slate-700 shadow-2xs hover:bg-brand-50 dark:hover:bg-slate-800 transition-colors';
const ICON_BTN = 'flex h-9 w-9 items-center justify-center rounded-[7px] bg-white dark:bg-slate-900 border border-brand-300/60 dark:border-slate-700 shadow-2xs text-slate-600 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-slate-800 transition-colors cursor-pointer focus:outline-hidden';

interface HeaderProps {
  user: UserProfile;
  activeTitle: string;
  activeSubtitle?: string;
  notifications: SystemNotification[];
  companyUnits?: CompanyUnit[];
  activeCompanyUnitCode?: string;
  onSelectCompanyUnit?: (code: string) => void;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onDismissNotification: (id: string) => void;
  onClearNotifications: () => void;
  /** Opens the document or module a notification links to. */
  onOpenNotification: (notification: SystemNotification) => void;
  onNavigateToModule: (moduleKey: string) => void;
  onResetData?: () => void;
  onLogout: () => void;
  onToggleMobileSidebar: () => void;
  /** Users with the "Gửi thông báo" rights may publish notifications; called after one is sent. */
  onNotificationPublished?: () => void;
  /** The user edited their profile or changed their password. */
  onUserUpdated: (user: UserProfile) => void;
  onLanguageChanged?: () => void | Promise<void>;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTitle,
  activeSubtitle,
  notifications,
  companyUnits = [],
  activeCompanyUnitCode,
  onSelectCompanyUnit,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDismissNotification,
  onClearNotifications,
  onOpenNotification,
  onNavigateToModule,
  onResetData,
  onLogout,
  onToggleMobileSidebar,
  onNotificationPublished,
  onUserUpdated,
  onLanguageChanged
}) => {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, languages, t } = useLanguage();

  /** Switches at once and saves the choice to the profile, so it follows the user to other devices. */
  const changeLanguage = (code: string) => {
    setLanguage(code);
    void onLanguageChanged?.();
    authService.setMyLanguage(code).then(onUserUpdated).catch(error => showToast.error(getErrorMessage(error)));
  };
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<MyAccountTab | null>(null);
  const confirm = useConfirm();
  // Same rule as the backend: admin or the special rights "Gửi thông báo" on overview_main.
  const canPublishAll = hasRight(user, 'overview_main', RIGHTS.SEND_NOTIFICATION_ALL);
  const canPublish = Boolean(onNotificationPublished)
    && (canPublishAll || hasRight(user, 'overview_main', RIGHTS.SEND_NOTIFICATION));

  const currentUnit = companyUnits.find(u => u.code === activeCompanyUnitCode) || companyUnits[0];

  return (
    <header className="bg-brand-200 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-5 py-1.5 sm:py-2 flex items-center justify-between gap-2 min-w-0 shrink-0 transition-colors">
      
      {/* Title & Mobile Toggle */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[5px] cursor-pointer"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 font-display truncate">
            {activeTitle}
          </h1>
        </div>
      </div>

      {/* Right toolbar: working unit, language, theme, notifications, account */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

        {/* Working company unit */}
        {companyUnits.length > 0 && onSelectCompanyUnit && (
          <label className={`${PILL} hidden sm:flex max-w-[260px]`} title={t('common.workingCompanyUnit')}>
            <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-brand-100 dark:bg-slate-700 shrink-0">
              <Building2 className="h-3 w-3 text-brand-700 dark:text-brand-300" />
            </span>
            <select
              value={activeCompanyUnitCode || currentUnit?.code || ''}
              onChange={(e) => onSelectCompanyUnit(e.target.value)}
              aria-label={t('common.workingCompanyUnit')}
              className="min-w-0 flex-1 appearance-none bg-transparent pr-4 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer outline-hidden truncate"
            >
              {companyUnits.map(u => (
                <option key={u.id} value={u.code} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                  {u.code} - {u.localizedName || u.shortName || u.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-slate-400" />
          </label>
        )}

        {/* Language picker: the active languages of Settings › Ngôn ngữ */}
        {languages.length > 1 && (
          <label className={PILL} title={t('common.language')}>
            <Globe className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300 shrink-0" />
            <select value={language} onChange={(e) => changeLanguage(e.target.value)} aria-label={t('common.language')}
              className="appearance-none bg-transparent pr-4 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer outline-hidden">
              {languages.map(l => <option key={l.code} value={l.code} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">{l.code.toUpperCase()} · {l.nativeName}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-slate-400" />
          </label>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className={ICON_BTN}
          title={theme === 'dark' ? t('common.switchToLight') : t('common.switchToDark')}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-slate-600" />
          )}
        </button>

        {/* Notification Bell Dropdown */}
        <NotificationDropdown
          notifications={notifications}
          onMarkAsRead={onMarkNotificationRead}
          onMarkAllAsRead={onMarkAllNotificationsRead}
          onDismiss={onDismissNotification}
          onClearAll={onClearNotifications}
          onSelectNotification={onOpenNotification}
          onCompose={canPublish ? () => setIsPublishOpen(true) : undefined}
        />
        {canPublish && (
          <PublishNotificationModal
            isOpen={isPublishOpen}
            onClose={() => setIsPublishOpen(false)}
            companyUnits={companyUnits}
            allUnits={canPublishAll}
            currentUnitCode={activeCompanyUnitCode}
            onPublished={() => onNotificationPublished?.()}
          />
        )}

        <div className="h-5 w-px bg-brand-300/60 dark:bg-slate-700 mx-0.5"></div>

        {/* User Profile Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex h-9 items-center gap-2 pl-1.5 pr-2 rounded-[7px] bg-white dark:bg-slate-900 hover:bg-brand-50 dark:hover:bg-slate-800 transition-colors cursor-pointer focus:outline-hidden border border-brand-300/60 dark:border-slate-700 shadow-2xs"
          >
            <div className="h-6 w-6 bg-brand-600 text-white rounded-[5px] flex items-center justify-center font-bold text-xs">
              {user.fullName.charAt(0)}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                {user.fullName}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight">@{user.username}</p>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400 hidden sm:block" />
          </button>

          {userDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserDropdownOpen(false)}></div>
              <div className="absolute right-0 mt-2 w-56 bg-brand-50 dark:bg-slate-900 border border-brand-200 dark:border-slate-800 rounded-[9px] shadow-xl z-50 p-2 text-xs space-y-1 animate-fade-in">
                <div className="p-2.5 rounded-[7px] bg-brand-50 dark:bg-slate-800/80 border border-brand-200 dark:border-slate-700/60 mb-1.5">
                  <p className="font-bold text-slate-900 dark:text-slate-100">{user.fullName}</p>
                  <p className="text-[10px] text-slate-400">{user.email}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 bg-brand-100 dark:bg-indigo-950/50 px-2 py-0.5 rounded-[5px] mt-1">
                    <ShieldCheck className="h-3 w-3" />
                    {user.role}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    setAccountTab('profile');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-brand-100 dark:hover:bg-slate-800 rounded-[5px] transition-colors text-left font-semibold cursor-pointer"
                >
                  <UserRound className="h-4 w-4 text-slate-400" />
                  {t('layout.header.accountInfo')}
                </button>

                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    setAccountTab('password');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-brand-100 dark:hover:bg-slate-800 rounded-[5px] transition-colors text-left font-semibold cursor-pointer"
                >
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  {t('layout.header.changePassword')}
                </button>

                {onResetData && (
                  <button
                    onClick={async () => {
                      setUserDropdownOpen(false);
                      const ok = await confirm({
                        title: t('layout.header.resetDemoTitle'),
                        message: t('layout.header.resetDemoMessage'),
                        confirmLabel: t('layout.header.resetDemoConfirm'),
                        tone: 'warning'
                      });
                      if (ok) onResetData();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-[5px] transition-colors text-left font-semibold cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t('layout.header.resetDemo')}
                  </button>
                )}

                <div className="border-t border-brand-200 dark:border-slate-800 my-1 pt-1"></div>

                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-[5px] transition-colors text-left font-semibold cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  {t('common.logout')}
                </button>
              </div>
            </>
          )}
        </div>

      </div>

      {accountTab && (
        <MyAccountModal
          user={user}
          companyUnits={companyUnits}
          initialTab={accountTab}
          onClose={() => setAccountTab(null)}
          onUserUpdated={onUserUpdated}
        />
      )}

    </header>
  );
};
