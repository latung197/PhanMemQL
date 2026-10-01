import React from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  fullScreen?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, headerActions, children, maxWidth = 'md', fullScreen = false }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    'full': 'max-w-full'
  };

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 z-50 animate-fade-in overflow-hidden">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[9px] w-full h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.5rem)] p-3 sm:p-4 shadow-2xl flex flex-col min-h-0 gap-3">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3 shrink-0 gap-3">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-1 min-w-0 truncate">
              {title}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-[5px] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-hidden cursor-pointer"
                title={t('controls.modal.closeEsc')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden pt-1">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-fade-in overflow-y-auto">
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[9px] w-full ${widthClasses[maxWidth] || 'max-w-md'} p-5 sm:p-6 shadow-xl space-y-4 max-h-[92vh] flex flex-col min-h-0`}>
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3.5 shrink-0 gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 truncate min-w-0">
            {title}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-[5px] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-hidden cursor-pointer"
              title={t('controls.modal.close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto custom-scrollbar grow pr-0.5 pt-1">{children}</div>
      </div>
    </div>
  );
};
