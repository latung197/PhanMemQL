import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, subtitle, action }) => {
  return (
    <div className={`min-w-0 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[9px] p-3 sm:p-5 shadow-xs transition-colors ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap justify-between items-start sm:items-center pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div className="min-w-0">
            {typeof title === 'string' ? (
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{title}</h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
